let db; // Variable global para almacenar la referencia a la base de datos IndexedDB

// Función para abrir o crear la base de datos "ClientesDB"
const abrirIndexedDB = () => {
    const request = indexedDB.open("ClientesDB", 1); // Se abre (o crea si no existe) la base de datos "ClientesDB" con versión 1

    // Evento que se dispara si la base de datos necesita una actualización de estructura (como la creación de almacenes de objetos)
    request.onupgradeneeded = function (event) {
        db = event.target.result; // Se obtiene la referencia a la base de datos
        if (!db.objectStoreNames.contains("clientes")) { // Verifica si el almacén de objetos "clientes" no existe
            // Crea el almacén de objetos "clientes" con clave primaria "id" y autoincremento
            const store = db.createObjectStore("clientes", { keyPath: "id", autoIncrement: true });
            // Se crean índices para búsquedas por "nombre" y "email"
            store.createIndex("nombre", "nombre", { unique: false });
            store.createIndex("email", "email", { unique: false });
        }
    };

    // Evento que se ejecuta cuando la base de datos se abre con éxito
    request.onsuccess = function (event) {
        db = event.target.result; // Se guarda la referencia a la base de datos
        console.log("IndexedDB abierta correctamente.");
        cargarClientesLocalmente(); // Se cargan los clientes almacenados
    };

    // Evento que maneja errores al abrir la base de datos
    request.onerror = function (event) {
        console.error("Error al abrir IndexedDB:", event.target.errorCode);
    };
};

// Función para guardar un cliente en IndexedDB
const guardarClienteLocalmente = (cliente) => {
    const transaction = db.transaction(["clientes"], "readwrite"); // Se crea una transacción en modo lectura/escritura
    const store = transaction.objectStore("clientes"); // Se obtiene el almacén de objetos "clientes"
    store.add(cliente); // Se agrega el nuevo cliente a la base de datos

    // Evento que se ejecuta cuando la transacción se completa con éxito
    transaction.oncomplete = () => {
        console.log("Cliente guardado en IndexedDB");
        cargarClientesLocalmente(); // Se actualiza la lista de clientes
    };

    // Evento que maneja errores en la transacción
    transaction.onerror = (event) => {
        console.error("Error al guardar cliente:", event.target.errorCode);
    };
};

// Función para cargar todos los clientes almacenados en IndexedDB
const cargarClientesLocalmente = () => {
    const transaction = db.transaction(["clientes"], "readonly"); // Se crea una transacción en modo solo lectura
    const store = transaction.objectStore("clientes"); // Se obtiene el almacén de objetos "clientes"
    const request = store.getAll(); // Se solicita obtener todos los clientes almacenados

    // Evento que se ejecuta cuando la solicitud de obtener clientes tiene éxito
    request.onsuccess = () => {
        mostrarClientes(request.result); // Llama a la función para mostrar los clientes en la interfaz
    };
};

// Función para agregar un cliente desde un formulario HTML
const agregarClienteLocalmente = (event) => {
    event.preventDefault(); // Previene el envío del formulario
    // Se obtiene la información del cliente desde los campos del formulario
    const cliente = {
        nombre: document.getElementById("nombre").value,
        apellido: document.getElementById("apellido").value,
        email: document.getElementById("email").value,
        telefono: document.getElementById("telefono").value
    };
    guardarClienteLocalmente(cliente); // Se guarda el cliente en IndexedDB
};

// Evento que se ejecuta cuando el documento HTML ha cargado completamente
document.addEventListener("DOMContentLoaded", () => {
    abrirIndexedDB(); // Se abre la base de datos al cargar la página
    // Se asigna el evento click al botón "btn-guardar-local" para agregar un cliente al hacer clic
    document.getElementById("btn-guardar-local").addEventListener("click", agregarClienteLocalmente);
});
