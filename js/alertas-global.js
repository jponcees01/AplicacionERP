/* ============================================================
   ALERTAS GLOBALES DEL SIDEBAR
   Este archivo debe cargarse en todos los HTML.
============================================================ */

const INTERVALO_ALERTAS_GLOBAL = 60000;

let intervaloAlertasGlobal = null;


/* ============================================================
   INICIALIZACIÓN
============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        iniciarAlertasGlobales();
    }
);


/* ============================================================
   INICIAR ALERTAS GLOBALES
============================================================ */

function iniciarAlertasGlobales() {

    const menuAlertas =
        document.getElementById(
            "menuAlertas"
        );

    const contadorAlertas =
        document.getElementById(
            "contadorAlertasSidebar"
        );

    /*
     * Si la página no tiene el menú de alertas,
     * no se realiza ninguna consulta.
     */
    if (
        !menuAlertas ||
        !contadorAlertas
    ) {
        return;
    }

    const token =
        obtenerTokenAlertasGlobales();

    if (!token) {

        ocultarContadorAlertasGlobales();

        return;
    }

    cargarContadorAlertasGlobales();

    /*
     * Evita crear más de un intervalo.
     */
    if (
        intervaloAlertasGlobal !== null
    ) {

        clearInterval(
            intervaloAlertasGlobal
        );
    }

    intervaloAlertasGlobal =
        setInterval(
            cargarContadorAlertasGlobales,
            INTERVALO_ALERTAS_GLOBAL
        );
}


/* ============================================================
   OBTENER DATOS DE SESIÓN
============================================================ */

function obtenerDatosSesionAlertasGlobales() {

    try {

        if (
            typeof CONFIG === "undefined" ||
            typeof CONFIG.getData !== "function"
        ) {

            console.error(
                "CONFIG no está disponible"
            );

            return null;
        }

        return CONFIG.getData();

    } catch (error) {

        console.error(
            "No se pudieron obtener los datos de sesión:",
            error
        );

        return null;
    }
}


/* ============================================================
   OBTENER TOKEN
============================================================ */

function obtenerTokenAlertasGlobales() {

    const datos =
        obtenerDatosSesionAlertasGlobales();

    const token =
        datos?.accessToken;

    if (
        !token ||
        typeof token !== "string" ||
        token.trim() === ""
    ) {
        return null;
    }

    return token.trim();
}


/* ============================================================
   OBTENER HEADERS
============================================================ */

function obtenerHeadersAlertasGlobales() {

    const token =
        obtenerTokenAlertasGlobales();

    if (!token) {

        throw new Error(
            "No se encontró el token de acceso"
        );
    }

    return {
        Accept: "application/json",
        Authorization: `Bearer ${token}`
    };
}


/* ============================================================
   CONSULTAR CONTADOR
============================================================ */

async function cargarContadorAlertasGlobales() {

    try {

        const token =
            obtenerTokenAlertasGlobales();

        if (!token) {

            ocultarContadorAlertasGlobales();

            return;
        }

        /*
         * No se envía idAlmacen.
         * Cuenta alertas de todos los almacenes.
         */
        const url =
            `${CONFIG.API_URL}/alertas/no-leidas/count`;

        const response =
            await fetch(
                url,
                {
                    method: "GET",
                    headers:
                        obtenerHeadersAlertasGlobales()
                }
            );

        if (
            response.status === 401 ||
            response.status === 403
        ) {

            ocultarContadorAlertasGlobales();

            return;
        }

        if (!response.ok) {

            console.error(
                "No se pudo consultar el contador de alertas:",
                response.status
            );

            return;
        }

        const resultado =
            await response.json();

        const cantidad =
            convertirCantidadAlertasGlobales(
                resultado?.cantidad
            );

        actualizarContadorAlertasGlobales(
            cantidad
        );

    } catch (error) {

        console.error(
            "Error consultando alertas globales:",
            error
        );
    }
}


/* ============================================================
   ACTUALIZAR CONTADOR
============================================================ */

function actualizarContadorAlertasGlobales(
    cantidad
) {

    const menuAlertas =
        document.getElementById(
            "menuAlertas"
        );

    const contadorAlertas =
        document.getElementById(
            "contadorAlertasSidebar"
        );

    if (
        !menuAlertas ||
        !contadorAlertas
    ) {
        return;
    }

    contadorAlertas.textContent =
        cantidad > 99
            ? "99+"
            : String(cantidad);

    if (
        cantidad > 0
    ) {

        contadorAlertas.classList.remove(
            "d-none"
        );

        contadorAlertas.classList.add(
            "alerta-activa"
        );

        menuAlertas.classList.add(
            "tiene-alertas"
        );

        menuAlertas.title =
            cantidad === 1
                ? "Tienes 1 alerta nueva"
                : `Tienes ${cantidad} alertas nuevas`;

        menuAlertas.setAttribute(
            "aria-label",
            cantidad === 1
                ? "Alertas, tienes 1 notificación nueva"
                : `Alertas, tienes ${cantidad} notificaciones nuevas`
        );

    } else {

        ocultarContadorAlertasGlobales();
    }
}


/* ============================================================
   OCULTAR CONTADOR
============================================================ */

function ocultarContadorAlertasGlobales() {

    const menuAlertas =
        document.getElementById(
            "menuAlertas"
        );

    const contadorAlertas =
        document.getElementById(
            "contadorAlertasSidebar"
        );

    if (contadorAlertas) {

        contadorAlertas.textContent =
            "0";

        contadorAlertas.classList.add(
            "d-none"
        );

        contadorAlertas.classList.remove(
            "alerta-activa"
        );
    }

    if (menuAlertas) {

        menuAlertas.classList.remove(
            "tiene-alertas"
        );

        menuAlertas.title =
            "No tienes alertas nuevas";

        menuAlertas.setAttribute(
            "aria-label",
            "Alertas, sin notificaciones nuevas"
        );
    }
}


/* ============================================================
   CONVERTIR CANTIDAD
============================================================ */

function convertirCantidadAlertasGlobales(
    valor
) {

    const numero =
        Number(
            valor
        );

    if (
        !Number.isFinite(numero) ||
        numero < 0
    ) {
        return 0;
    }

    return Math.trunc(
        numero
    );
}


/* ============================================================
   ACTUALIZACIÓN MANUAL

   Puedes llamar esta función después de:
   - registrar una venta;
   - recibir un envío;
   - enviar una guía;
   - registrar una devolución;
   - hacer un reabastecimiento;
   - modificar stock.
============================================================ */

function actualizarAlertasGlobales() {

    cargarContadorAlertasGlobales();
}
