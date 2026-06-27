/* ============================================================
   ASISTENTE IA - CHATBOT
   Endpoint:
   POST /api/v1/asistente/consultar
============================================================ */


/* ============================================================
   CONFIGURACIÓN
============================================================ */

const CHATBOT_CONFIG = {

    endpoint:
        `${CONFIG.API_URL}/asistente/consultar`,

    claveHistorial:
        "historialAsistenteIA",

    limiteMensajesHistorial:
        30,

    tiempoMaximoEspera:
        10 * 60 * 1000
};


/* ============================================================
   ESTADO GLOBAL
============================================================ */

let chatbotProcesando = false;

let controladorPeticionChatbot = null;

let historialChatbot = [];


/* ============================================================
   ELEMENTOS DEL HTML
============================================================ */

const formChat =
    document.getElementById(
        "formChat"
    );

const mensajeInput =
    document.getElementById(
        "mensajeInput"
    );

const btnEnviar =
    document.getElementById(
        "btnEnviar"
    );

const iconoEnviar =
    document.getElementById(
        "iconoEnviar"
    );

const spinnerEnviar =
    document.getElementById(
        "spinnerEnviar"
    );

const chatMensajes =
    document.getElementById(
        "chatMensajes"
    );

const chatSugerencias =
    document.getElementById(
        "chatSugerencias"
    );

const indicadorEscribiendo =
    document.getElementById(
        "indicadorEscribiendo"
    );

const contadorCaracteres =
    document.getElementById(
        "contadorCaracteres"
    );

const textoEstadoAsistente =
    document.getElementById(
        "textoEstadoAsistente"
    );

const estadoPuntoAsistente =
    document.getElementById(
        "estadoPuntoAsistente"
    );


/* ============================================================
   INICIALIZACIÓN
============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        configurarEventosChatbot();

        cargarHistorialChatbot();

        renderizarHistorialChatbot();

        actualizarContadorCaracteres();

        ajustarAlturaTextarea();

        verificarSesionChatbot();

        mostrarSugerenciasChatbot();

        mensajeInput?.focus();
    }
);


/* ============================================================
   CONFIGURAR EVENTOS
============================================================ */

function configurarEventosChatbot() {

    formChat?.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();

            await enviarMensajeChatbot();
        }
    );


    mensajeInput?.addEventListener(
        "input",
        function () {

            actualizarContadorCaracteres();

            ajustarAlturaTextarea();
        }
    );


    mensajeInput?.addEventListener(
        "keydown",
        async function (event) {

            /*
             * ENTER envía el mensaje.
             * SHIFT + ENTER agrega una nueva línea.
             */
            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                await enviarMensajeChatbot();
            }
        }
    );
}


/* ============================================================
   VERIFICAR SESIÓN
============================================================ */

function verificarSesionChatbot() {

    const token =
        obtenerTokenChatbot();

    if (!token) {

        cambiarEstadoAsistente(
            "Sin sesión",
            "error"
        );

        bloquearFormularioChatbot(
            true
        );

        mostrarToastChatbot(
            "No se encontró una sesión válida",
            "danger"
        );

        return;
    }

    cambiarEstadoAsistente(
        "En línea",
        "disponible"
    );
}


/* ============================================================
   OBTENER DATOS DE SESIÓN
============================================================ */

function obtenerDatosSesionChatbot() {

    try {

        if (
            typeof CONFIG === "undefined" ||
            typeof CONFIG.getData !== "function"
        ) {

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


function obtenerTokenChatbot() {

    const datos =
        obtenerDatosSesionChatbot();

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
   ENVIAR MENSAJE
============================================================ */

async function enviarMensajeChatbot() {

    if (chatbotProcesando) {
        return;
    }

    const mensaje =
        mensajeInput
            ?.value
            ?.trim();

    if (!mensaje) {

        mostrarToastChatbot(
            "Escribe una consulta antes de enviar",
            "warning"
        );

        mensajeInput?.focus();

        return;
    }

    if (
        mensaje.length > 1000
    ) {

        mostrarToastChatbot(
            "La consulta no puede superar los 1000 caracteres",
            "warning"
        );

        return;
    }

    const token =
        obtenerTokenChatbot();

    if (!token) {

        mostrarToastChatbot(
            "No se encontró el token de acceso",
            "danger"
        );

        return;
    }

    agregarMensajeChatbot(
        "usuario",
        mensaje
    );

    mensajeInput.value = "";

    actualizarContadorCaracteres();

    ajustarAlturaTextarea();

    ocultarSugerenciasChatbot();

    activarCargaChatbot();

    controladorPeticionChatbot =
        new AbortController();

    const temporizador =
        setTimeout(
            function () {

                controladorPeticionChatbot?.abort();
            },
            CHATBOT_CONFIG.tiempoMaximoEspera
        );

    let consultaExitosa = false;

    try {

        const response =
            await fetch(
                CHATBOT_CONFIG.endpoint,
                {
                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        Accept:
                            "application/json",

                        Authorization:
                            `Bearer ${token}`
                    },

                    body:
                        JSON.stringify(
                            {
                                mensaje:
                                    mensaje
                            }
                        ),

                    signal:
                        controladorPeticionChatbot.signal
                }
            );

        if (
            response.status === 401
        ) {

            throw new Error(
                "Tu sesión ha vencido. Inicia sesión nuevamente."
            );
        }

        if (
            response.status === 403
        ) {

            throw new Error(
                "No tienes autorización para usar el asistente."
            );
        }

        if (!response.ok) {

            throw new Error(
                await leerErrorChatbot(
                    response,
                    "No se pudo obtener una respuesta del asistente"
                )
            );
        }

        const resultado =
            await response.json();

        const respuesta =
            limpiarRespuestaChatbot(
                resultado?.respuesta
            );

        agregarMensajeChatbot(
            "asistente",
            respuesta ||
            "La consulta se ejecutó correctamente, pero no se obtuvo una respuesta."
        );

        console.log(
            "Consulta generada:",
            resultado?.sqlGenerado
        );

        console.log(
            "Registros obtenidos:",
            resultado?.cantidadRegistros
        );

        consultaExitosa = true;

    } catch (error) {

        console.error(
            "Error consultando al asistente:",
            error
        );

        let mensajeError =
            error.message ||
            "No se pudo consultar al asistente";

        if (
            error.name === "AbortError"
        ) {

            mensajeError =
                "La consulta demoró demasiado y fue cancelada.";
        }

        if (
            error instanceof TypeError &&
            error.message === "Failed to fetch"
        ) {

            mensajeError =
                "No se pudo conectar con el servidor. Verifica que Spring Boot y Ollama estén ejecutándose.";
        }

        agregarMensajeChatbot(
            "error",
            mensajeError
        );

        cambiarEstadoAsistente(
            "Error de conexión",
            "error"
        );

    } finally {

        clearTimeout(
            temporizador
        );

        controladorPeticionChatbot =
            null;

        desactivarCargaChatbot();

        /*
         * Volver a mostrar las preguntas sugeridas
         * cuando termine la consulta.
         */
        mostrarSugerenciasChatbot();

        /*
         * Si la consulta fue correcta, volver a mostrar
         * el asistente como disponible.
         */
        if (consultaExitosa) {

            cambiarEstadoAsistente(
                "En línea",
                "disponible"
            );
        }

        mensajeInput?.focus();

        desplazarChatAlFinal();
    }
}


/* ============================================================
   AGREGAR MENSAJE
============================================================ */

function agregarMensajeChatbot(
    tipo,
    contenido,
    guardar = true
) {

    if (!chatMensajes) {
        return;
    }

    const mensaje =
        {
            tipo:
                tipo,

            contenido:
                String(
                    contenido ?? ""
                ),

            fecha:
                new Date().toISOString()
        };

    if (guardar) {

        historialChatbot.push(
            mensaje
        );

        limitarHistorialChatbot();

        guardarHistorialChatbot();
    }

    const elemento =
        crearElementoMensajeChatbot(
            mensaje
        );

    chatMensajes.appendChild(
        elemento
    );

    desplazarChatAlFinal();
}


/* ============================================================
   CREAR MENSAJE HTML
============================================================ */

function crearElementoMensajeChatbot(
    mensaje
) {

    const fila =
        document.createElement(
            "div"
        );

    const tipo =
        mensaje.tipo;

    fila.className =
        `chat-mensaje-fila chat-mensaje-${tipo}`;


    const avatar =
        document.createElement(
            "div"
        );

    avatar.className =
        "chat-mensaje-avatar";


    const icono =
        document.createElement(
            "i"
        );

    if (
        tipo === "usuario"
    ) {

        icono.className =
            "bi bi-person-fill";

    } else if (
        tipo === "error"
    ) {

        icono.className =
            "bi bi-exclamation-triangle-fill";

    } else {

        icono.className =
            "bi bi-robot";
    }

    avatar.appendChild(
        icono
    );


    const burbuja =
        document.createElement(
            "div"
        );

    burbuja.className =
        "chat-mensaje-burbuja";


    const contenido =
        document.createElement(
            "div"
        );

    contenido.className =
        "chat-mensaje-texto";

    contenido.textContent =
        mensaje.contenido;


    const hora =
        document.createElement(
            "small"
        );

    hora.className =
        "chat-mensaje-hora";

    hora.textContent =
        formatearHoraChatbot(
            mensaje.fecha
        );


    burbuja.appendChild(
        contenido
    );

    burbuja.appendChild(
        hora
    );


    if (
        tipo === "usuario"
    ) {

        fila.appendChild(
            burbuja
        );

        fila.appendChild(
            avatar
        );

    } else {

        fila.appendChild(
            avatar
        );

        fila.appendChild(
            burbuja
        );
    }

    return fila;
}


/* ============================================================
   MENSAJE INICIAL
============================================================ */

function crearMensajeInicialChatbot() {

    const nombreUsuario =
        obtenerNombreUsuarioChatbot();

    const saludo =
        nombreUsuario
            ? `Hola, ${nombreUsuario}.`
            : "Hola.";

    return {
        tipo:
            "asistente",

        contenido:
            `${saludo} Soy el asistente de tu ERP. Puedes preguntarme sobre inventario, stock bajo, ventas, kardex, reabastecimientos y solicitudes de stock.`,

        fecha:
            new Date().toISOString()
    };
}


function obtenerNombreUsuarioChatbot() {

    const datos =
        obtenerDatosSesionChatbot();

    return (
        datos?.primerNombre ||
        datos?.nombre ||
        ""
    ).trim();
}


/* ============================================================
   HISTORIAL
============================================================ */

function cargarHistorialChatbot() {

    try {

        const guardado =
            localStorage.getItem(
                CHATBOT_CONFIG.claveHistorial
            );

        if (!guardado) {

            historialChatbot = [
                crearMensajeInicialChatbot()
            ];

            guardarHistorialChatbot();

            return;
        }

        const historial =
            JSON.parse(
                guardado
            );

        historialChatbot =
            Array.isArray(historial)
                ? historial
                : [];

        if (
            historialChatbot.length === 0
        ) {

            historialChatbot = [
                crearMensajeInicialChatbot()
            ];
        }

    } catch (error) {

        console.error(
            "No se pudo cargar el historial:",
            error
        );

        historialChatbot = [
            crearMensajeInicialChatbot()
        ];
    }
}


function guardarHistorialChatbot() {

    try {

        localStorage.setItem(
            CHATBOT_CONFIG.claveHistorial,
            JSON.stringify(
                historialChatbot
            )
        );

    } catch (error) {

        console.error(
            "No se pudo guardar el historial:",
            error
        );
    }
}


function limitarHistorialChatbot() {

    if (
        historialChatbot.length >
        CHATBOT_CONFIG.limiteMensajesHistorial
    ) {

        historialChatbot =
            historialChatbot.slice(
                -CHATBOT_CONFIG.limiteMensajesHistorial
            );
    }
}


function renderizarHistorialChatbot() {

    if (!chatMensajes) {
        return;
    }

    chatMensajes.innerHTML = "";

    historialChatbot.forEach(
        function (mensaje) {

            const elemento =
                crearElementoMensajeChatbot(
                    mensaje
                );

            chatMensajes.appendChild(
                elemento
            );
        }
    );

    desplazarChatAlFinal();
}


/* ============================================================
   LIMPIAR CONVERSACIÓN
============================================================ */

function limpiarConversacion() {

    if (chatbotProcesando) {

        mostrarToastChatbot(
            "Espera a que termine la consulta actual",
            "warning"
        );

        return;
    }

    const confirmar =
        confirm(
            "¿Deseas limpiar toda la conversación?"
        );

    if (!confirmar) {
        return;
    }

    historialChatbot = [
        crearMensajeInicialChatbot()
    ];

    guardarHistorialChatbot();

    renderizarHistorialChatbot();

    mostrarSugerenciasChatbot();

    mostrarToastChatbot(
        "Conversación limpiada",
        "success"
    );

    mensajeInput?.focus();
}


/* ============================================================
   USAR SUGERENCIA
============================================================ */

function usarSugerencia(
    texto
) {

    if (
        chatbotProcesando ||
        !mensajeInput
    ) {
        return;
    }

    mensajeInput.value =
        texto;

    actualizarContadorCaracteres();

    ajustarAlturaTextarea();

    mensajeInput.focus();

    enviarMensajeChatbot();
}


/* ============================================================
   ESTADO DE CARGA
============================================================ */

function activarCargaChatbot() {

    chatbotProcesando = true;

    bloquearFormularioChatbot(
        true
    );

    indicadorEscribiendo
        ?.classList
        .remove(
            "d-none"
        );

    iconoEnviar
        ?.classList
        .add(
            "d-none"
        );

    spinnerEnviar
        ?.classList
        .remove(
            "d-none"
        );

    cambiarEstadoAsistente(
        "Consultando...",
        "procesando"
    );

    desplazarChatAlFinal();
}


function desactivarCargaChatbot() {

    chatbotProcesando = false;

    bloquearFormularioChatbot(
        false
    );

    indicadorEscribiendo
        ?.classList
        .add(
            "d-none"
        );

    iconoEnviar
        ?.classList
        .remove(
            "d-none"
        );

    spinnerEnviar
        ?.classList
        .add(
            "d-none"
        );
}


function bloquearFormularioChatbot(
    bloquear
) {

    if (mensajeInput) {

        mensajeInput.disabled =
            bloquear;
    }

    if (btnEnviar) {

        btnEnviar.disabled =
            bloquear;
    }
}


/* ============================================================
   ESTADO DEL ASISTENTE
============================================================ */

function cambiarEstadoAsistente(
    texto,
    estado
) {

    if (textoEstadoAsistente) {

        textoEstadoAsistente.textContent =
            texto;
    }

    if (!estadoPuntoAsistente) {
        return;
    }

    estadoPuntoAsistente.classList.remove(
        "estado-disponible",
        "estado-procesando",
        "estado-error"
    );

    switch (estado) {

        case "procesando":

            estadoPuntoAsistente.classList.add(
                "estado-procesando"
            );

            break;

        case "error":

            estadoPuntoAsistente.classList.add(
                "estado-error"
            );

            break;

        default:

            estadoPuntoAsistente.classList.add(
                "estado-disponible"
            );

            break;
    }
}


/* ============================================================
   SUGERENCIAS
============================================================ */

function ocultarSugerenciasChatbot() {

    chatSugerencias
        ?.classList
        .add(
            "d-none"
        );
}


function mostrarSugerenciasChatbot() {

    chatSugerencias
        ?.classList
        .remove(
            "d-none"
        );
}


/* ============================================================
   TEXTAREA
============================================================ */

function actualizarContadorCaracteres() {

    if (
        !contadorCaracteres ||
        !mensajeInput
    ) {
        return;
    }

    contadorCaracteres.textContent =
        `${mensajeInput.value.length}/1000`;
}


function ajustarAlturaTextarea() {

    if (!mensajeInput) {
        return;
    }

    mensajeInput.style.height =
        "auto";

    const altura =
        Math.min(
            mensajeInput.scrollHeight,
            140
        );

    mensajeInput.style.height =
        `${altura}px`;
}


/* ============================================================
   LIMPIAR RESPUESTA DEL MODELO
============================================================ */

function limpiarRespuestaChatbot(
    respuesta
) {

    if (!respuesta) {
        return "";
    }

    return String(
        respuesta
    )

        .replace(
            /```[\s\S]*?```/g,
            ""
        )

        .replace(
            /\*\*(.*?)\*\*/g,
            "$1"
        )

        .replace(
            /\*(.*?)\*/g,
            "$1"
        )

        .replace(
            /^#{1,6}\s+/gm,
            ""
        )

        .replace(
            /\n{3,}/g,
            "\n\n"
        )

        .trim();
}


/* ============================================================
   LEER ERROR DEL BACKEND
============================================================ */

async function leerErrorChatbot(
    response,
    mensajeDefecto
) {

    try {

        const contentType =
            response.headers.get(
                "content-type"
            ) || "";

        if (
            contentType.includes(
                "application/json"
            )
        ) {

            const error =
                await response.json();

            return (
                error.message ||
                error.mensaje ||
                error.error ||
                error.detalle ||
                error.respuesta ||
                mensajeDefecto
            );
        }

        const texto =
            await response.text();

        return (
            texto.trim() ||
            mensajeDefecto
        );

    } catch (error) {

        return mensajeDefecto;
    }
}


/* ============================================================
   DESPLAZAR CHAT
============================================================ */

function desplazarChatAlFinal() {

    if (!chatMensajes) {
        return;
    }

    requestAnimationFrame(
        function () {

            chatMensajes.scrollTop =
                chatMensajes.scrollHeight;

            indicadorEscribiendo?.scrollIntoView(
                {
                    behavior:
                        "smooth",

                    block:
                        "end"
                }
            );
        }
    );
}


/* ============================================================
   FORMATEAR HORA
============================================================ */

function formatearHoraChatbot(
    fechaValor
) {

    const fecha =
        new Date(
            fechaValor
        );

    if (
        Number.isNaN(
            fecha.getTime()
        )
    ) {
        return "";
    }

    return new Intl.DateTimeFormat(
        "es-PE",
        {
            hour:
                "2-digit",

            minute:
                "2-digit"
        }
    ).format(
        fecha
    );
}


/* ============================================================
   TOAST
============================================================ */

function mostrarToastChatbot(
    mensaje,
    tipo = "success"
) {

    const toast =
        document.getElementById(
            "toastMensaje"
        );

    const texto =
        document.getElementById(
            "textoToast"
        );

    if (
        !toast ||
        !texto ||
        typeof bootstrap === "undefined"
    ) {

        console.log(
            mensaje
        );

        return;
    }

    texto.textContent =
        mensaje;

    toast.className =
        `toast align-items-center border-0 text-bg-${tipo}`;

    bootstrap.Toast
        .getOrCreateInstance(
            toast
        )
        .show();
}
