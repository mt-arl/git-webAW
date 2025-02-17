const API_URL = 'http://10.40.8.127:8002/api/clientes';
let db;

// Abrir o crear la base de datos "ClientesDB"
const abrirIndexedDB = () => {
    const request = indexedDB.open("ClientesDB", 1);

    request.onupgradeneeded = function (event) {
        db = event.target.result;
        if (!db.objectStoreNames.contains("clientes")) {
            const store = db.createObjectStore("clientes", { keyPath: "id", autoIncrement: true });
            store.createIndex("nombre", "nombre", { unique: false });
            store.createIndex("email", "email", { unique: false });
            store.createIndex("guardadoLocalmente", "guardadoLocalmente", { unique: false });
        }
        
        // Crear store para operaciones pendientes
        if (!db.objectStoreNames.contains("operacionesPendientes")) {
            const store = db.createObjectStore("operacionesPendientes", { keyPath: "id", autoIncrement: true });
            store.createIndex("tipo", "tipo", { unique: false });
            store.createIndex("fecha", "fecha", { unique: false });
        }
    };

    request.onsuccess = function (event) {
        db = event.target.result;
        console.log("IndexedDB abierta correctamente.");
        cargarClientes(); // Cambiado para cargar todos los clientes al inicio
        
        // Verificar conexión y ejecutar operaciones pendientes
        window.addEventListener('online', sincronizarOperacionesPendientes);
        if (navigator.onLine) {
            sincronizarOperacionesPendientes();
        }
    };

    request.onerror = function (event) {
        console.error("Error al abrir IndexedDB:", event.target.errorCode);
    };
};

// Guardar cliente en API y si falla, guardar localmente
const guardarCliente = async (cliente) => {
    if (navigator.onLine) {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(cliente)
            });
            
            if (response.ok) {
                const clienteGuardado = await response.json();
                console.log("Cliente guardado en API:", clienteGuardado);
                cargarClientes();
                limpiarFormulario();
                return;
            } else {
                console.error("Error al guardar cliente en API:", response.status);
            }
        } catch (error) {
            console.error("Error al guardar cliente en API:", error);
        }
    }
    
    // Si no hay conexión o falló la solicitud, guardar localmente y registrar operación pendiente
    guardarClienteLocalmente(cliente);
    registrarOperacionPendiente('agregar', cliente);
};

// Guardar cliente en IndexedDB
const guardarClienteLocalmente = (cliente) => {
    if (!db) {
        console.error("Base de datos no inicializada");
        return;
    }

    const transaction = db.transaction(["clientes"], "readwrite");
    const store = transaction.objectStore("clientes");
    
    // Asegurarse de que el cliente tenga la marca de guardado local
    const clienteParaGuardar = {
        ...cliente,
        guardadoLocalmente: true
    };
    
    const request = store.add(clienteParaGuardar);
    
    request.onsuccess = () => {
        console.log("Cliente guardado en IndexedDB");
        cargarClientesLocalmente();
        limpiarFormulario();
    };
    
    request.onerror = (event) => {
        console.error("Error al guardar cliente:", event.target.error);
    };
};

// Registrar operación pendiente
const registrarOperacionPendiente = (tipo, datos) => {
    if (!db) {
        console.error("Base de datos no inicializada");
        return;
    }

    const transaction = db.transaction(["operacionesPendientes"], "readwrite");
    const store = transaction.objectStore("operacionesPendientes");
    
    const operacion = {
        tipo,
        datos,
        fecha: new Date().toISOString()
    };
    
    store.add(operacion);
};

// Sincronizar operaciones pendientes cuando hay conexión
const sincronizarOperacionesPendientes = async () => {
    if (!db || !navigator.onLine) return;

    const transaction = db.transaction(["operacionesPendientes"], "readonly");
    const store = transaction.objectStore("operacionesPendientes");
    const request = store.getAll();

    request.onsuccess = async () => {
        const operaciones = request.result;
        if (operaciones.length === 0) return;

        console.log("Ejecutando operaciones pendientes:", operaciones);
        
        for (const op of operaciones) {
            let exito = false;
            
            try {
                if (op.tipo === 'agregar') {
                    const response = await fetch(API_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(op.datos)
                    });
                    exito = response.ok;
                } else if (op.tipo === 'eliminar') {
                    const response = await fetch(`${API_URL}/${op.datos.id}`, {
                        method: 'DELETE'
                    });
                    exito = response.ok;
                }
                
                if (exito) {
                    // Eliminar operación pendiente
                    const deleteTransaction = db.transaction(["operacionesPendientes"], "readwrite");
                    const deleteStore = deleteTransaction.objectStore("operacionesPendientes");
                    deleteStore.delete(op.id);
                    console.log(`Operación ${op.tipo} completada y eliminada de pendientes`);
                }
            } catch (error) {
                console.error(`Error al ejecutar operación pendiente ${op.tipo}:`, error);
            }
        }
        
        // Recargar clientes después de sincronizar
        cargarClientes();
    };
};

// Cargar clientes desde IndexedDB
const cargarClientesLocalmente = () => {
    if (!db) {
        console.error("Base de datos no inicializada");
        return;
    }

    const transaction = db.transaction(["clientes"], "readonly");
    const store = transaction.objectStore("clientes");
    const request = store.getAll();

    request.onsuccess = () => {
        const clientesLocales = request.result.filter(cliente => cliente.guardadoLocalmente);
        mostrarClientes(clientesLocales);
    };
};

// Cargar clientes desde la API
async function cargarClientes() {
    try {
        const res = await fetch(API_URL);
        let clientes = [];
        
        if (res.ok) {
            clientes = await res.json();
            console.log("Clientes cargados de la API:", clientes);
        } else {
            console.error("Error al cargar clientes de la API:", res.status);
        }
        
        // Obtener clientes locales
        const clientesLocales = await obtenerClientesLocales();
        console.log("Clientes locales:", clientesLocales);
        
        // Combinar y mostrar todos los clientes
        const todosLosClientes = [...clientes, ...clientesLocales];
        mostrarClientes(todosLosClientes);
    } catch (error) {
        console.error("Error al cargar clientes:", error);
        cargarClientesLocalmente();
    }
}

// Función auxiliar para obtener clientes locales
function obtenerClientesLocales() {
    return new Promise((resolve, reject) => {
        if (!db) {
            resolve([]);
            return;
        }

        const transaction = db.transaction(["clientes"], "readonly");
        const store = transaction.objectStore("clientes");
        const request = store.getAll();

        request.onsuccess = () => {
            const clientesLocales = request.result.filter(cliente => cliente.guardadoLocalmente);
            resolve(clientesLocales);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

// Mostrar clientes en la tabla
function mostrarClientes(clientes) {
    const tabla = document.getElementById('clientes-table');
    if (!tabla) {
        console.error("Elemento tabla no encontrado");
        return;
    }

    tabla.innerHTML = "";
    clientes.forEach(cliente => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${cliente.id || cliente.codigo || ''}</td>
            <td>${cliente.nombre || ''} ${cliente.apellido || cliente.apellidoPaterno || ''}</td>
            <td>${cliente.email || ''}</td>
            <td>${cliente.telefono || ''}</td>
            <td>
                <span class="badge ${cliente.guardadoLocalmente ? 'bg-success' : 'bg-primary'}">
                    ${cliente.guardadoLocalmente ? 'Local' : 'API'}
                </span>
            </td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="eliminarCliente(${cliente.id})">
                    <i class="fas fa-trash"></i>
                </button>
                ${!cliente.guardadoLocalmente ? `
                    <button class="btn btn-success btn-sm" onclick="guardarClienteLocal(${JSON.stringify(cliente).replace(/"/g, "'")})">
                        <i class="fas fa-download"></i>
                    </button>
                ` : ''}
            </td>
        `;
        tabla.appendChild(row);
    });
}

// Función para guardar un cliente de la API localmente
function guardarClienteLocal(cliente) {
    guardarClienteLocalmente(cliente);
}

// Eliminar cliente
async function eliminarCliente(id) {
    if (!db || !id) return;

    if (confirm('¿Está seguro de eliminar este cliente?')) {
        // Intentar eliminar en API primero
        if (navigator.onLine) {
            try {
                const response = await fetch(`${API_URL}/${id}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    console.log("Cliente eliminado de la API");
                } else {
                    console.error("Error al eliminar cliente de la API:", response.status);
                    // Si falla, registrar operación pendiente
                    registrarOperacionPendiente('eliminar', { id });
                }
            } catch (error) {
                console.error("Error al eliminar cliente de la API:", error);
                registrarOperacionPendiente('eliminar', { id });
            }
        } else {
            // Sin conexión, registrar operación pendiente
            registrarOperacionPendiente('eliminar', { id });
        }
        
        // Siempre eliminar localmente para reflejar cambios
        const transaction = db.transaction(["clientes"], "readwrite");
        const store = transaction.objectStore("clientes");
        
        try {
            await store.delete(id);
            console.log("Cliente eliminado de IndexedDB");
        } catch (error) {
            console.error("Error al eliminar cliente localmente:", error);
        }
        
        cargarClientes();
    }
}

// Limpiar formulario
function limpiarFormulario() {
    const form = document.getElementById('cliente-form');
    if (form) {
        form.reset();
    }
}

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
    abrirIndexedDB();
    
    const form = document.getElementById('cliente-form');
    const btnMostrarTodos = document.getElementById('mostrar-todos');
    const btnMostrarLocales = document.getElementById('mostrar-locales');
    
    if (form) {
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const nuevoCliente = {
                nombre: document.getElementById('nombre').value,
                apellido: document.getElementById('apellido').value,
                email: document.getElementById('email').value,
                telefono: document.getElementById('telefono').value
            };
            guardarCliente(nuevoCliente);
        });
    }
    
    if (btnMostrarTodos) {
        btnMostrarTodos.addEventListener('click', cargarClientes);
    }
    
    if (btnMostrarLocales) {
        btnMostrarLocales.addEventListener('click', cargarClientesLocalmente);
    }
});