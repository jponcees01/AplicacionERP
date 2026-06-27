/* ============================================================
   INICIALIZACIÓN DE SESIÓN
============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const sesionValida =
            validarSesion();

        if (!sesionValida) {
            return;
        }

        cargarInformacionUsuario();
    }
);


/* ============================================================
   OBTENER DATOS DE SESIÓN
============================================================ */

function obtenerDatosSesion() {

    try {

        if (
            typeof CONFIG !== "undefined" &&
            typeof CONFIG.getData === "function"
        ) {
            return CONFIG.getData();
        }

        const datosGuardados =
            localStorage.getItem("data");

        if (!datosGuardados) {
            return null;
        }

        return JSON.parse(
            datosGuardados
        );

    } catch (error) {

        console.error(
            "No se pudieron leer los datos de sesión:",
            error
        );

        return null;
    }
}


/* ============================================================
   OBTENER DATOS INDIVIDUALES
============================================================ */

function obtenerTokenSesion() {

    const datos =
        obtenerDatosSesion();

    return (
        datos?.accessToken ??
        localStorage.getItem("accessToken") ??
        null
    );
}


function obtenerRefreshTokenSesion() {

    const datos =
        obtenerDatosSesion();

    return (
        datos?.refreshToken ??
        localStorage.getItem("refreshToken") ??
        null
    );
}


function obtenerIdUsuarioSesion() {

    const datos =
        obtenerDatosSesion();

    return convertirNumeroSesion(
        datos?.idUsuario
    );
}


function obtenerIdAlmacenSesion() {

    const datos =
        obtenerDatosSesion();

    return convertirNumeroSesion(
        datos?.idAlmacen
    );
}


function obtenerUsernameSesion() {

    const datos =
        obtenerDatosSesion();

    return (
        datos?.username ??
        datos?.usuario ??
        "usuario"
    );
}


function obtenerRolSesion() {

    const datos =
        obtenerDatosSesion();

    return (
        datos?.rol ??
        datos?.nombreRol ??
        "SIN_ROL"
    );
}


/* ============================================================
   VALIDAR SESIÓN
============================================================ */

function validarSesion() {

    const datos =
        obtenerDatosSesion();

    const token =
        obtenerTokenSesion();

    if (
        !datos ||
        !token
    ) {

        limpiarSesion();

        redirigirLogin();

        return false;
    }

    if (
        tokenExpirado(token)
    ) {

        console.warn(
            "La sesión ha expirado"
        );

        limpiarSesion();

        redirigirLogin();

        return false;
    }

    return true;
}


/* ============================================================
   VALIDAR EXPIRACIÓN DEL JWT
============================================================ */

function tokenExpirado(
    token
) {

    try {

        const partes =
            token.split(".");

        if (partes.length !== 3) {

            /*
             * Si no tiene formato JWT, no se puede validar aquí.
             * El backend realizará la validación definitiva.
             */
            return false;
        }

        const payloadBase64 =
            partes[1]
                .replace(/-/g, "+")
                .replace(/_/g, "/");

        const payloadTexto =
            decodeURIComponent(
                atob(payloadBase64)
                    .split("")
                    .map(
                        function (caracter) {

                            return (
                                "%" +
                                caracter
                                    .charCodeAt(0)
                                    .toString(16)
                                    .padStart(2, "0")
                            );
                        }
                    )
                    .join("")
            );

        const payload =
            JSON.parse(payloadTexto);

        if (!payload.exp) {
            return false;
        }

        const fechaExpiracion =
            payload.exp * 1000;

        return Date.now() >=
            fechaExpiracion;

    } catch (error) {

        console.warn(
            "No se pudo comprobar la expiración del token:",
            error
        );

        return false;
    }
}


/* ============================================================
   CARGAR INFORMACIÓN DEL USUARIO
============================================================ */

function cargarInformacionUsuario() {

    const datos =
        obtenerDatosSesion();

    if (!datos) {
        return;
    }

    const nombreCompleto =
        obtenerNombreCompleto(datos);

    const username =
        datos.username ??
        datos.usuario ??
        datos.correo ??
        "usuario";

    const rol =
        datos.rol ??
        datos.nombreRol ??
        "Sin rol";

    const nombreElemento =
        document.getElementById(
            "nombreUsuarioSesion"
        );

    const rolElemento =
        document.getElementById(
            "rolUsuarioSesion"
        );

    const usernameElemento =
        document.getElementById(
            "usernameSesion"
        );

    const avatarElemento =
        document.getElementById(
            "usuarioAvatar"
        );

    const nombreBienvenida =
        document.getElementById(
            "nombreBienvenida"
        );

    if (nombreElemento) {

        nombreElemento.textContent =
            nombreCompleto;

        nombreElemento.title =
            nombreCompleto;
    }

    if (rolElemento) {

        rolElemento.textContent =
            formatearRol(
                rol
            );
    }

    if (usernameElemento) {

        usernameElemento.textContent =
            String(username).includes("@")
                ? username
                : `@${username}`;
    }

    if (avatarElemento) {

        avatarElemento.textContent =
            obtenerIniciales(
                nombreCompleto
            );
    }

    if (nombreBienvenida) {

        nombreBienvenida.textContent =
            nombreCompleto;
    }
}


/* ============================================================
   CONSTRUIR NOMBRE DEL USUARIO
============================================================ */

function obtenerNombreCompleto(
    usuario
) {

    const nombreCompleto =
        usuario.nombreCompleto ??
        usuario.nombre_completo;

    if (
        nombreCompleto &&
        String(nombreCompleto).trim()
    ) {
        return String(
            nombreCompleto
        ).trim();
    }

    const nombreConstruido =
        construirNombreCompleto(
            usuario
        );

    if (nombreConstruido) {
        return nombreConstruido;
    }

    return (
        usuario.username ??
        usuario.usuario ??
        "Usuario"
    );
}


function construirNombreCompleto(
    usuario
) {

    const nombres =
        usuario.nombres ??
        usuario.primerNombre ??
        usuario.primer_nombre ??
        usuario.nombre ??
        "";

    const apellidos =
        usuario.apellidos ??
        combinarApellidos(
            usuario
        );

    return `${nombres} ${apellidos}`
        .replace(/\s+/g, " ")
        .trim();
}


function combinarApellidos(
    usuario
) {

    const apellidoPaterno =
        usuario.apellidoPaterno ??
        usuario.apellido_paterno ??
        "";

    const apellidoMaterno =
        usuario.apellidoMaterno ??
        usuario.apellido_materno ??
        "";

    return `${apellidoPaterno} ${apellidoMaterno}`
        .replace(/\s+/g, " ")
        .trim();
}


/* ============================================================
   INICIALES DEL AVATAR
============================================================ */

function obtenerIniciales(
    nombreCompleto
) {

    const palabras =
        String(
            nombreCompleto ?? ""
        )
            .trim()
            .split(/\s+/)
            .filter(Boolean);

    if (
        palabras.length === 0
    ) {
        return "U";
    }

    if (
        palabras.length === 1
    ) {

        return palabras[0]
            .substring(0, 2)
            .toUpperCase();
    }

    return (
        palabras[0].charAt(0) +
        palabras[1].charAt(0)
    ).toUpperCase();
}


/* ============================================================
   FORMATEAR ROL
============================================================ */

function formatearRol(
    rol
) {

    const texto =
        String(
            rol ?? "Sin rol"
        )
            .replace(
                /^ROLE_/i,
                ""
            )
            .replaceAll(
                "_",
                " "
            )
            .toLowerCase();

    return texto.replace(
        /\b\w/g,
        function (letra) {

            return letra.toUpperCase();
        }
    );
}


/* ============================================================
   HEADERS AUTENTICADOS
============================================================ */

function obtenerHeadersSesion(
    enviarJson = false
) {

    const headers = {
        Accept: "application/json"
    };

    const token =
        obtenerTokenSesion();

    if (token) {

        headers.Authorization =
            `Bearer ${token}`;
    }

    if (enviarJson) {

        headers["Content-Type"] =
            "application/json";
    }

    return headers;
}


/* ============================================================
   CERRAR SESIÓN
============================================================ */

function cerrarSesion() {

    const confirmar =
        window.confirm(
            "¿Deseas cerrar la sesión?"
        );

    if (!confirmar) {
        return;
    }

    limpiarSesion();

    redirigirLogin();
}


/* ============================================================
   LIMPIAR SESIÓN
============================================================ */

function limpiarSesion() {

    localStorage.removeItem(
        "data"
    );

    localStorage.removeItem(
        "accessToken"
    );

    localStorage.removeItem(
        "refreshToken"
    );

    /*
     * Se eliminan también las claves anteriores,
     * por compatibilidad con el código antiguo.
     */
    localStorage.removeItem(
        "token"
    );

    localStorage.removeItem(
        "usuario"
    );

    localStorage.removeItem(
        "conversacionChatbot"
    );

    /*
     * No se elimina usuarioRecordado porque pertenece
     * a la opción Recordarme.
     */
}


/* ============================================================
   REDIRECCIÓN AL LOGIN
============================================================ */

function redirigirLogin() {

    const rutaActual =
        window.location.pathname;

    if (
        rutaActual.endsWith(
            "/index.html"
        ) ||
        rutaActual === "/" ||
        rutaActual.endsWith("/")
    ) {
        return;
    }

    window.location.replace(
        "../index.html"
    );
}


/* ============================================================
   UTILIDADES
============================================================ */

function convertirNumeroSesion(
    valor
) {

    if (
        valor === null ||
        valor === undefined ||
        valor === ""
    ) {
        return null;
    }

    const numero =
        Number(valor);

    return Number.isFinite(numero)
        ? numero
        : null;
}