"use strict";

/* ============================================================
   RENOVACIÓN GLOBAL DE SESIÓN
============================================================ */

(function () {

    if (typeof CONFIG === "undefined") {

        console.error(
            "CONFIG no está disponible. Debes cargar config.js antes de renovar-sesion.js."
        );

        return;
    }

    /* ============================================================
       CONFIGURACIÓN
    ============================================================ */

    const URL_REFRESH =
        `${CONFIG.API_URL}/auth/refresh`;

    /*
     * Mostrar el modal 60 segundos antes de que venza
     * el access token.
     */
    const SEGUNDOS_ANTES_DE_EXPIRAR = 60;

    /*
     * Fetch original para evitar que el endpoint de refresh
     * sea interceptado nuevamente.
     */
    const fetchOriginal =
        window.fetch.bind(window);


    /* ============================================================
       VARIABLES
    ============================================================ */

    let modalRenovarSesion = null;

    let temporizadorExpiracion = null;

    let promesaDecisionUsuario = null;

    let resolverDecisionUsuario = null;

    let promesaRefresh = null;

    let cerrandoSesion = false;


    /* ============================================================
       DATOS DE SESIÓN
    ============================================================ */

    function obtenerDatosSesion() {

        try {

            if (
                typeof CONFIG.getData ===
                "function"
            ) {

                return (
                    CONFIG.getData() ||
                    null
                );
            }

            const data =
                localStorage.getItem(
                    "data"
                );

            return data
                ? JSON.parse(data)
                : null;

        } catch (error) {

            console.error(
                "No se pudieron obtener los datos de sesión:",
                error
            );

            return null;
        }
    }


    function guardarDatosSesion(
        datos
    ) {

        localStorage.setItem(
            "data",
            JSON.stringify(datos)
        );
    }


    function obtenerAccessToken() {

        const datos =
            obtenerDatosSesion();

        return (
            datos?.accessToken ||
            datos?.token ||
            localStorage.getItem(
                "accessToken"
            ) ||
            localStorage.getItem(
                "token"
            ) ||
            null
        );
    }


    function obtenerRefreshToken() {

        const datos =
            obtenerDatosSesion();

        return (
            datos?.refreshToken ||
            localStorage.getItem(
                "refreshToken"
            ) ||
            null
        );
    }


    /* ============================================================
       DECODIFICAR JWT
    ============================================================ */

    function decodificarJwt(
        token
    ) {

        try {

            if (
                !token ||
                typeof token !== "string"
            ) {

                return null;
            }

            const partes =
                token.split(".");

            if (
                partes.length < 2
            ) {

                return null;
            }

            let payloadBase64 =
                partes[1]
                    .replace(/-/g, "+")
                    .replace(/_/g, "/");

            while (
                payloadBase64.length % 4 !== 0
            ) {

                payloadBase64 += "=";
            }

            const payloadTexto =
                decodeURIComponent(
                    atob(payloadBase64)
                        .split("")
                        .map(
                            function (caracter) {

                                return (
                                    "%" +
                                    (
                                        "00" +
                                        caracter
                                            .charCodeAt(0)
                                            .toString(16)
                                    ).slice(-2)
                                );
                            }
                        )
                        .join("")
                );

            return JSON.parse(
                payloadTexto
            );

        } catch (error) {

            console.error(
                "No se pudo decodificar el access token:",
                error
            );

            return null;
        }
    }


    function obtenerFechaExpiracionToken(
        token
    ) {

        const payload =
            decodificarJwt(
                token
            );

        if (
            !payload ||
            !payload.exp
        ) {

            return null;
        }

        return new Date(
            Number(payload.exp) * 1000
        );
    }


    function obtenerMilisegundosRestantes(
        token
    ) {

        const fechaExpiracion =
            obtenerFechaExpiracionToken(
                token
            );

        if (!fechaExpiracion) {

            return null;
        }

        return (
            fechaExpiracion.getTime() -
            Date.now()
        );
    }


    function tokenEstaExpirado(
        token
    ) {

        const milisegundosRestantes =
            obtenerMilisegundosRestantes(
                token
            );

        if (
            milisegundosRestantes === null
        ) {

            return false;
        }

        return (
            milisegundosRestantes <= 0
        );
    }


    /* ============================================================
       CREAR MODAL
    ============================================================ */

    function crearModalRenovacion() {

        const modalExistente =
            document.getElementById(
                "modalRenovarSesion"
            );

        if (modalExistente) {

            modalRenovarSesion =
                bootstrap.Modal.getOrCreateInstance(
                    modalExistente
                );

            configurarEventosModal();

            return;
        }

        const modalHtml = `
            <div
                class="modal fade"
                id="modalRenovarSesion"
                tabindex="-1"
                aria-labelledby="modalRenovarSesionLabel"
                aria-hidden="true"
                data-bs-backdrop="static"
                data-bs-keyboard="false"
            >

                <div
                    class="modal-dialog modal-dialog-centered"
                >

                    <div
                        class="modal-content border-0 rounded-4 shadow"
                    >

                        <div class="modal-header">

                            <h5
                                class="modal-title fw-bold"
                                id="modalRenovarSesionLabel"
                            >
                                <i
                                    class="bi bi-clock-history text-warning me-2"
                                ></i>

                                Sesión por expirar
                            </h5>

                        </div>

                        <div class="modal-body">

                            <div
                                id="mensajeSesionExpirada"
                                class="alert alert-warning mb-0"
                            >
                                <i
                                    class="bi bi-exclamation-triangle me-2"
                                ></i>

                                Tu sesión está por expirar.

                                ¿Deseas continuar trabajando?
                            </div>

                            <div
                                id="mensajeRenovandoSesion"
                                class="text-center py-4 d-none"
                            >

                                <span
                                    class="spinner-border spinner-border-sm text-primary me-2"
                                    role="status"
                                ></span>

                                Renovando sesión...

                            </div>

                            <div
                                id="errorRenovarSesion"
                                class="alert alert-danger mt-3 mb-0 d-none"
                            ></div>

                        </div>

                        <div class="modal-footer">

                            <button
                                type="button"
                                class="btn btn-outline-secondary"
                                id="btnCerrarSesionExpirada"
                            >
                                <i
                                    class="bi bi-box-arrow-right me-2"
                                ></i>

                                Cerrar sesión
                            </button>

                            <button
                                type="button"
                                class="btn btn-primary"
                                id="btnRenovarSesion"
                            >
                                <i
                                    class="bi bi-arrow-clockwise me-2"
                                ></i>

                                Continuar sesión
                            </button>

                        </div>

                    </div>

                </div>

            </div>
        `;

        document.body.insertAdjacentHTML(
            "beforeend",
            modalHtml
        );

        const modalElemento =
            document.getElementById(
                "modalRenovarSesion"
            );

        modalRenovarSesion =
            bootstrap.Modal.getOrCreateInstance(
                modalElemento
            );

        configurarEventosModal();
    }


    function configurarEventosModal() {

        const botonRenovar =
            document.getElementById(
                "btnRenovarSesion"
            );

        const botonCerrar =
            document.getElementById(
                "btnCerrarSesionExpirada"
            );

        botonRenovar?.removeEventListener(
            "click",
            confirmarRenovacionDesdeModal
        );

        botonCerrar?.removeEventListener(
            "click",
            cancelarRenovacionDesdeModal
        );

        botonRenovar?.addEventListener(
            "click",
            confirmarRenovacionDesdeModal
        );

        botonCerrar?.addEventListener(
            "click",
            cancelarRenovacionDesdeModal
        );
    }


    /* ============================================================
       MOSTRAR MODAL
    ============================================================ */

    function solicitarDecisionRenovacion(
        tokenExpirado = false
    ) {

        crearModalRenovacion();

        if (
            promesaDecisionUsuario
        ) {

            return promesaDecisionUsuario;
        }

        limpiarErrorModal();

        cambiarTextoModal(
            tokenExpirado
        );

        promesaDecisionUsuario =
            new Promise(
                function (resolve) {

                    resolverDecisionUsuario =
                        resolve;

                    modalRenovarSesion.show();
                }
            );

        return promesaDecisionUsuario;
    }


    function cambiarTextoModal(
        tokenExpirado
    ) {

        const titulo =
            document.getElementById(
                "modalRenovarSesionLabel"
            );

        const mensaje =
            document.getElementById(
                "mensajeSesionExpirada"
            );

        if (tokenExpirado) {

            if (titulo) {

                titulo.innerHTML = `
                    <i
                        class="bi bi-clock-history text-danger me-2"
                    ></i>

                    Sesión expirada
                `;
            }

            if (mensaje) {

                mensaje.className =
                    "alert alert-danger mb-0";

                mensaje.innerHTML = `
                    <i
                        class="bi bi-exclamation-triangle me-2"
                    ></i>

                    Tu sesión ha expirado.

                    ¿Deseas renovar tu sesión para continuar?
                `;
            }

            return;
        }

        if (titulo) {

            titulo.innerHTML = `
                <i
                    class="bi bi-clock-history text-warning me-2"
                ></i>

                Sesión por expirar
            `;
        }

        if (mensaje) {

            mensaje.className =
                "alert alert-warning mb-0";

            mensaje.innerHTML = `
                <i
                    class="bi bi-exclamation-triangle me-2"
                ></i>

                Tu sesión está por expirar.

                ¿Deseas continuar trabajando?
            `;
        }
    }


    function resolverDecision(
        decision
    ) {

        if (
            resolverDecisionUsuario
        ) {

            resolverDecisionUsuario(
                decision
            );
        }

        resolverDecisionUsuario =
            null;

        promesaDecisionUsuario =
            null;
    }


    function confirmarRenovacionDesdeModal() {

        resolverDecision(
            true
        );
    }


    function cancelarRenovacionDesdeModal() {

        resolverDecision(
            false
        );

        cerrarSesionCompleta();
    }


    /* ============================================================
       ESTADO DEL MODAL
    ============================================================ */

    function cambiarEstadoModal(
        procesando
    ) {

        const botonRenovar =
            document.getElementById(
                "btnRenovarSesion"
            );

        const botonCerrar =
            document.getElementById(
                "btnCerrarSesionExpirada"
            );

        const mensajeRenovando =
            document.getElementById(
                "mensajeRenovandoSesion"
            );

        const mensajePrincipal =
            document.getElementById(
                "mensajeSesionExpirada"
            );

        if (botonRenovar) {

            botonRenovar.disabled =
                procesando;

            botonRenovar.innerHTML =
                procesando
                    ? `
                        <span
                            class="spinner-border spinner-border-sm me-2"
                            role="status"
                        ></span>

                        Renovando...
                    `
                    : `
                        <i
                            class="bi bi-arrow-clockwise me-2"
                        ></i>

                        Continuar sesión
                    `;
        }

        if (botonCerrar) {

            botonCerrar.disabled =
                procesando;
        }

        mensajeRenovando
            ?.classList
            .toggle(
                "d-none",
                !procesando
            );

        mensajePrincipal
            ?.classList
            .toggle(
                "d-none",
                procesando
            );
    }


    function mostrarErrorModal(
        mensaje
    ) {

        const elemento =
            document.getElementById(
                "errorRenovarSesion"
            );

        if (!elemento) {

            return;
        }

        elemento.textContent =
            mensaje;

        elemento.classList.remove(
            "d-none"
        );
    }


    function limpiarErrorModal() {

        const elemento =
            document.getElementById(
                "errorRenovarSesion"
            );

        if (!elemento) {

            return;
        }

        elemento.textContent = "";

        elemento.classList.add(
            "d-none"
        );
    }


    /* ============================================================
       RENOVAR ACCESS TOKEN
    ============================================================ */

    async function renovarAccessToken() {

        /*
         * Si varias peticiones reciben 401 al mismo tiempo,
         * todas esperan una única renovación.
         */
        if (
            promesaRefresh
        ) {

            return promesaRefresh;
        }

        promesaRefresh =
            ejecutarRenovacionToken();

        try {

            return await promesaRefresh;

        } finally {

            promesaRefresh =
                null;
        }
    }


    async function ejecutarRenovacionToken() {

        cambiarEstadoModal(
            true
        );

        limpiarErrorModal();

        try {

            const refreshToken =
                obtenerRefreshToken();

            if (!refreshToken) {

                throw new Error(
                    "No se encontró el refresh token."
                );
            }

            const response =
                await fetchOriginal(
                    URL_REFRESH,
                    {
                        method: "POST",

                        headers: {

                            Accept:
                                "application/json",

                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                refreshToken:
                                    refreshToken
                            }),

                        cache:
                            "no-store"
                    }
                );

            const contentType =
                response.headers.get(
                    "content-type"
                ) || "";

            let respuesta = null;

            if (
                contentType.includes(
                    "application/json"
                )
            ) {

                respuesta =
                    await response.json();

            } else {

                respuesta =
                    await response.text();
            }

            if (!response.ok) {

                throw new Error(
                    respuesta?.mensaje ||
                    respuesta?.message ||
                    respuesta?.error ||
                    respuesta ||
                    "No se pudo renovar la sesión."
                );
            }

            const nuevoAccessToken =
                respuesta?.accessToken ||
                respuesta?.token ||
                respuesta?.data?.accessToken ||
                respuesta?.data?.token ||
                null;

            const nuevoRefreshToken =
                respuesta?.refreshToken ||
                respuesta?.data?.refreshToken ||
                refreshToken;

            if (!nuevoAccessToken) {

                throw new Error(
                    "El backend no devolvió un nuevo access token."
                );
            }

            guardarTokens(
                nuevoAccessToken,
                nuevoRefreshToken
            );

            modalRenovarSesion?.hide();

            programarAvisoExpiracion();

            window.dispatchEvent(
                new CustomEvent(
                    "tokenRenovado",
                    {
                        detail: {
                            accessToken:
                                nuevoAccessToken
                        }
                    }
                )
            );

            return nuevoAccessToken;

        } catch (error) {

            console.error(
                "Error renovando el access token:",
                error
            );

            mostrarErrorModal(
                error?.message ||
                "No se pudo renovar la sesión."
            );

            throw error;

        } finally {

            cambiarEstadoModal(
                false
            );
        }
    }


    function guardarTokens(
        accessToken,
        refreshToken
    ) {

        const datosActuales =
            obtenerDatosSesion() || {};

        const nuevosDatos = {
            ...datosActuales,

            accessToken:
                accessToken,

            refreshToken:
                refreshToken
        };

        guardarDatosSesion(
            nuevosDatos
        );

        localStorage.setItem(
            "accessToken",
            accessToken
        );

        localStorage.setItem(
            "refreshToken",
            refreshToken
        );
    }


    /* ============================================================
       PROGRAMAR AVISO ANTES DE EXPIRAR
    ============================================================ */

    function programarAvisoExpiracion() {

        clearTimeout(
            temporizadorExpiracion
        );

        temporizadorExpiracion =
            null;

        const accessToken =
            obtenerAccessToken();

        if (!accessToken) {

            return;
        }

        const milisegundosRestantes =
            obtenerMilisegundosRestantes(
                accessToken
            );

        /*
         * Si el JWT no tiene exp, solamente se controlará
         * mediante respuestas 401.
         */
        if (
            milisegundosRestantes === null
        ) {

            console.warn(
                "El access token no contiene el campo exp."
            );

            return;
        }

        const tiempoAntes =
            SEGUNDOS_ANTES_DE_EXPIRAR *
            1000;

        const tiempoEspera =
            milisegundosRestantes -
            tiempoAntes;

        const fechaExpiracion =
            obtenerFechaExpiracionToken(
                accessToken
            );

        console.log(
            "El access token vence:",
            fechaExpiracion
        );

        /*
         * Token ya expirado o vence dentro del tiempo de aviso.
         */
        if (
            tiempoEspera <= 0
        ) {

            setTimeout(
                function () {

                    procesarAvisoExpiracion(
                        tokenEstaExpirado(
                            accessToken
                        )
                    );
                },
                100
            );

            return;
        }

        console.log(
            "Modal de renovación en:",
            Math.floor(
                tiempoEspera / 1000
            ),
            "segundos"
        );

        temporizadorExpiracion =
            setTimeout(
                function () {

                    procesarAvisoExpiracion(
                        false
                    );
                },
                tiempoEspera
            );
    }


    async function procesarAvisoExpiracion(
        tokenExpirado
    ) {

        try {

            const deseaContinuar =
                await solicitarDecisionRenovacion(
                    tokenExpirado
                );

            if (!deseaContinuar) {

                return;
            }

            await renovarAccessToken();

        } catch (error) {

            console.error(
                "No se pudo renovar la sesión:",
                error
            );
        }
    }


    /* ============================================================
       INTERCEPTAR FETCH
    ============================================================ */

    window.fetch =
        async function (
            input,
            opciones = {}
        ) {

            const url =
                obtenerUrlPeticion(
                    input
                );

            /*
             * No interceptar login ni refresh.
             */
            if (
                esEndpointExcluido(
                    url
                )
            ) {

                return fetchOriginal(
                    input,
                    opciones
                );
            }

            const response =
                await fetchOriginal(
                    input,
                    opciones
                );

            /*
             * Solo intervenir cuando el backend responde 401.
             */
            if (
                response.status !== 401
            ) {

                return response;
            }

            try {

                const deseaRenovar =
                    await solicitarDecisionRenovacion(
                        true
                    );

                if (!deseaRenovar) {

                    throw new Error(
                        "La sesión ha finalizado."
                    );
                }

                const nuevoAccessToken =
                    await renovarAccessToken();

                return repetirPeticionConToken(
                    input,
                    opciones,
                    nuevoAccessToken
                );

            } catch (error) {

                console.error(
                    "No se pudo repetir la petición:",
                    error
                );

                throw error;
            }
        };


    function obtenerUrlPeticion(
        input
    ) {

        if (
            typeof input === "string"
        ) {

            return input;
        }

        if (
            input instanceof URL
        ) {

            return input.href;
        }

        if (
            input instanceof Request
        ) {

            return input.url;
        }

        return "";
    }


    function esEndpointExcluido(
        url
    ) {

        return (
            url.includes(
                "/auth/login"
            ) ||
            url.includes(
                "/auth/refresh"
            )
        );
    }


    async function repetirPeticionConToken(
        input,
        opciones,
        nuevoAccessToken
    ) {

        /*
         * Para los fetch normales del proyecto.
         */
        if (
            !(input instanceof Request)
        ) {

            const headers =
                new Headers(
                    opciones.headers || {}
                );

            headers.set(
                "Authorization",
                `Bearer ${nuevoAccessToken}`
            );

            return fetchOriginal(
                input,
                {
                    ...opciones,
                    headers:
                        headers
                }
            );
        }

        /*
         * Para fetch realizados usando Request.
         */
        const requestClonado =
            input.clone();

        const headers =
            new Headers(
                requestClonado.headers
            );

        headers.set(
            "Authorization",
            `Bearer ${nuevoAccessToken}`
        );

        const nuevaRequest =
            new Request(
                requestClonado,
                {
                    headers:
                        headers
                }
            );

        return fetchOriginal(
            nuevaRequest
        );
    }


    /* ============================================================
       CERRAR SESIÓN
    ============================================================ */

    function cerrarSesionCompleta() {

        if (cerrandoSesion) {

            return;
        }

        cerrandoSesion = true;

        clearTimeout(
            temporizadorExpiracion
        );

        localStorage.removeItem(
            "data"
        );

        localStorage.removeItem(
            "accessToken"
        );

        localStorage.removeItem(
            "refreshToken"
        );

        localStorage.removeItem(
            "token"
        );

        localStorage.removeItem(
            "usuario"
        );

        sessionStorage.clear();

        modalRenovarSesion?.hide();

        /*
         * Como tus páginas están dentro de /pages/,
         * normalmente el login estaría en login.html o ../login.html.
         * Cambia esta ruta según tu proyecto.
         */
        window.location.href =
            "../index.html";
    }


    /* ============================================================
       SINCRONIZAR ENTRE PESTAÑAS
    ============================================================ */

    window.addEventListener(
        "storage",
        function (event) {

            if (
                event.key === "data" ||
                event.key === "accessToken"
            ) {

                programarAvisoExpiracion();
            }

            if (
                event.key === "data" &&
                event.newValue === null
            ) {

                cerrarSesionCompleta();
            }
        }
    );


    /* ============================================================
       INICIALIZAR
    ============================================================ */

    function iniciarRenovacionSesion() {

        if (
            typeof bootstrap ===
            "undefined"
        ) {

            console.error(
                "Bootstrap no está disponible. Carga bootstrap.bundle.min.js antes de renovar-sesion.js."
            );

            return;
        }

        crearModalRenovacion();

        programarAvisoExpiracion();
    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            iniciarRenovacionSesion
        );

    } else {

        iniciarRenovacionSesion();
    }


    /* ============================================================
       FUNCIONES GLOBALES OPCIONALES
    ============================================================ */

    window.programarAvisoExpiracion =
        programarAvisoExpiracion;

    window.renovarAccessToken =
        renovarAccessToken;

})();