/* ============================================================
   PERMISOS GLOBALES POR ROL
============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        aplicarPermisosPorRol();
    }
);


/* ============================================================
   OBTENER INFORMACIÓN DEL USUARIO
============================================================ */

function obtenerDatosUsuarioPermisos() {

    try {

        /*
         * Primero intentar obtener los datos desde CONFIG.
         */
        if (
            typeof CONFIG !== "undefined" &&
            typeof CONFIG.getData === "function"
        ) {

            const datosConfig =
                CONFIG.getData();

            if (datosConfig) {

                return typeof datosConfig === "string"
                    ? JSON.parse(datosConfig)
                    : datosConfig;
            }
        }


        /*
         * Si CONFIG no está disponible, leer directamente
         * desde localStorage.
         */
        const datosGuardados =
            localStorage.getItem("data");

        if (!datosGuardados) {

            return null;
        }

        return JSON.parse(datosGuardados);

    } catch (error) {

        console.error(
            "Error obteniendo los datos del usuario:",
            error
        );

        return null;
    }
}


/* ============================================================
   OBTENER EL ROL ACTUAL
============================================================ */

function obtenerRolActual() {

    const datos =
        obtenerDatosUsuarioPermisos();

    if (!datos) {

        return "";
    }

    /*
     * Compatibilidad con distintas estructuras posibles.
     */
    const rol =
        datos.rol?.nombre ||
        datos.rol?.descripcion ||
        datos.rol ||
        datos.nombreRol ||
        datos.authority ||
        datos.perfil ||
        datos.usuario?.rol?.nombre ||
        datos.usuario?.rol ||
        "";

    return normalizarRol(rol);
}


/* ============================================================
   NORMALIZAR ROL
============================================================ */

function normalizarRol(rol) {

    return String(rol || "")
        .trim()
        .toUpperCase()
        .replace(/^ROLE_/, "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}


/* ============================================================
   VALIDAR ADMINISTRADOR
============================================================ */

function esAdministrador() {

    const rol =
        obtenerRolActual();

    return (
        rol === "ADMIN" ||
        rol === "ADMINISTRADOR" ||
        rol === "SUPERADMIN" ||
        rol === "SUPER_ADMIN"
    );
}


/* ============================================================
   APLICAR PERMISOS
============================================================ */

function aplicarPermisosPorRol() {

    const datos =
        obtenerDatosUsuarioPermisos();

    const rol =
        obtenerRolActual();

    const administrador =
        esAdministrador();

    console.log(
        "Datos de sesión:",
        datos
    );

    console.log(
        "Rol detectado:",
        rol
    );

    console.log(
        "Es administrador:",
        administrador
    );


    /*
     * Si es administrador, se agrega una clase al body.
     * El CSS mostrará todos los elementos .solo-admin.
     */
    document.body.classList.toggle(
        "usuario-admin",
        administrador
    );


    /*
     * Elementos que deben ocultarse al administrador.
     */
    document
        .querySelectorAll(".ocultar-admin")
        .forEach(
            function (elemento) {

                elemento.style.display =
                    administrador
                        ? "none"
                        : "";
            }
        );
}