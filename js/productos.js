/* =========================================================
   INICIALIZACIÓN
========================================================= */

document.addEventListener("DOMContentLoaded", async function () {
    await Promise.all([
        cargarComboProducto(
            "CATEGORIA",
            "idCategoria",
            "Seleccionar categoría"
        ),

        cargarComboProducto(
            "MARCA",
            "idMarca",
            "Seleccionar marca"
        ),

        cargarComboProducto(
            "PRODUCTO",
            "idProductoVariante",
            "Seleccionar producto"
        )
    ]);
});

/* =========================================================
   CARGAR COMBOS DESDE /inventario/combo
========================================================= */

async function cargarComboProducto(
    tipo,
    selectId,
    textoInicial,
    valorSeleccionado = null
) {
    const select = document.getElementById(selectId);

    if (!select) {
        console.error(`No existe el select con ID: ${selectId}`);
        return;
    }

    select.disabled = true;

    select.innerHTML = `
        <option value="">
            Cargando...
        </option>
    `;

    try {
        const token = obtenerToken();

        if (!token) {
            select.innerHTML = `
                <option value="">
                    Sesión no disponible
                </option>
            `;

            mostrarToast(
                "No se encontró la sesión del usuario",
                "danger"
            );

            return;
        }

        const parametros = new URLSearchParams({
            tipo: tipo
        });

        const url =
            `${CONFIG.API_URL}/inventario/combo?${parametros.toString()}`;

        console.log(`Consultando combo ${tipo}:`, url);

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });

        const resultado = await obtenerRespuesta(response);

        console.log(`Respuesta combo ${tipo}:`, resultado);

        if (!response.ok) {
            select.innerHTML = `
                <option value="">
                    No se pudo cargar
                </option>
            `;

            mostrarToast(
                obtenerMensajeError(
                    resultado,
                    `No se pudo cargar el combo ${tipo}`
                ),
                "danger"
            );

            return;
        }

        const opciones = Array.isArray(resultado)
            ? resultado
            : resultado?.content ?? [];

        llenarComboProducto(
            select,
            opciones,
            textoInicial,
            valorSeleccionado
        );

    } catch (error) {
        console.error(
            `Error al cargar el combo ${tipo}:`,
            error
        );

        select.innerHTML = `
            <option value="">
                Error al cargar
            </option>
        `;

        mostrarToast(
            `No se pudo cargar el combo ${tipo}`,
            "danger"
        );

    } finally {
        select.disabled = false;
    }
}

function llenarComboProducto(
    select,
    opciones,
    textoInicial,
    valorSeleccionado = null
) {
    select.innerHTML = `
        <option value="">
            ${textoInicial}
        </option>
    `;

    opciones.forEach(function (opcion) {
        const id =
            opcion.id ??
            opcion.idProducto ??
            opcion.idCategoria ??
            opcion.idMarca;

        const texto =
            opcion.texto ??
            opcion.nombreProducto ??
            opcion.nombre ??
            opcion.descripcion;

        if (id === null || id === undefined) {
            return;
        }

        const option = document.createElement("option");

        option.value = String(id);
        option.textContent = texto || `Registro ${id}`;

        select.appendChild(option);
    });

    if (
        valorSeleccionado !== null &&
        valorSeleccionado !== undefined
    ) {
        select.value = String(valorSeleccionado);
    }
}

/* =========================================================
   CREAR PRODUCTO
   POST /productos/crear
   multipart/form-data
========================================================= */

async function guardarProducto(event) {
    event.preventDefault();

    const nombre = obtenerValorProducto(
        "nombreProducto"
    );

    const idCategoria = obtenerValorProducto(
        "idCategoria"
    );

    const idMarca = obtenerValorProducto(
        "idMarca"
    );

    const inputImagen = document.getElementById(
        "imagenProducto"
    );

    const imagen = inputImagen?.files?.[0];

    if (!nombre) {
        mostrarToast(
            "Ingresa el nombre del producto",
            "warning"
        );
        return;
    }

    if (!idCategoria) {
        mostrarToast(
            "Selecciona una categoría",
            "warning"
        );
        return;
    }

    if (!idMarca) {
        mostrarToast(
            "Selecciona una marca",
            "warning"
        );
        return;
    }

    if (!imagen) {
        mostrarToast(
            "Selecciona una imagen",
            "warning"
        );
        return;
    }

    if (!validarTipoImagen(imagen)) {
        mostrarToast(
            "La imagen debe ser JPG, JPEG, PNG o WEBP",
            "warning"
        );
        return;
    }

    const tamanioMaximo = 5 * 1024 * 1024;

    if (imagen.size > tamanioMaximo) {
        mostrarToast(
            "La imagen no debe superar los 5 MB",
            "warning"
        );
        return;
    }

    const formData = new FormData();

    formData.append("nombre", nombre);
    formData.append("idCategoria", idCategoria);
    formData.append("idMarca", idMarca);
    formData.append("imagen", imagen);

    console.log("Producto enviado:", {
        nombre,
        idCategoria,
        idMarca,
        imagen: imagen.name
    });

    const boton = document.getElementById(
        "btnGuardarProducto"
    );

    const textoOriginal = boton?.innerHTML || "";

    try {
        const token = obtenerToken();

        if (!token) {
            mostrarToast(
                "No se encontró la sesión del usuario",
                "danger"
            );
            return;
        }

        mostrarCargandoBoton(
            boton,
            "Guardando..."
        );

        const response = await fetch(
            `${CONFIG.API_URL}/productos/crear`,
            {
                method: "POST",

                /*
                 * No agregar Content-Type.
                 * El navegador genera automáticamente
                 * multipart/form-data con su boundary.
                 */
                headers: {
                    "Accept": "application/json",
                    "Authorization": `Bearer ${token}`
                },

                body: formData
            }
        );

        const resultado = await obtenerRespuesta(response);

        console.log("Estado HTTP:", response.status);
        console.log("Producto creado:", resultado);

        if (!response.ok) {
            mostrarToast(
                obtenerMensajeError(
                    resultado,
                    "No se pudo crear el producto"
                ),
                "danger"
            );
            return;
        }

        mostrarToast(
            "Producto creado correctamente",
            "success"
        );

        limpiarFormularioProducto();

        /*
         * Recarga el combo de productos para que el producto
         * recién creado aparezca en la tarjeta de variantes.
         */
        await cargarComboProducto(
            "PRODUCTO",
            "idProductoVariante",
            "Seleccionar producto",
            obtenerIdCreado(
                resultado,
                ["idProducto", "id"]
            )
        );

    } catch (error) {
        console.error(
            "Error al crear el producto:",
            error
        );

        mostrarToast(
            "No se pudo conectar con el servidor",
            "danger"
        );

    } finally {
        restaurarBoton(
            boton,
            textoOriginal
        );
    }
}

/* =========================================================
   CREAR CATEGORÍA
   POST /categorias/crear
========================================================= */

async function agregarCategoria() {
    const nombre = obtenerValorProducto(
        "nuevaCategoria"
    );

    if (!nombre) {
        mostrarToast(
            "Ingresa el nombre de la categoría",
            "warning"
        );
        return;
    }

    const resultado = await enviarJson(
        `${CONFIG.API_URL}/categorias/crear`,
        {
            nombre: nombre
        },
        "btnAgregarCategoria",
        "Creando...",
        "Categoría creada correctamente",
        "No se pudo crear la categoría"
    );

    if (!resultado) {
        return;
    }

    asignarValorProducto(
        "nuevaCategoria",
        ""
    );

    const idCreado = obtenerIdCreado(
        resultado,
        ["idCategoria", "id"]
    );

    await cargarComboProducto(
        "CATEGORIA",
        "idCategoria",
        "Seleccionar categoría",
        idCreado
    );
}

/* =========================================================
   CREAR MARCA
   POST /marcas/crear
========================================================= */

async function agregarMarca() {
    const nombre = obtenerValorProducto(
        "nuevaMarca"
    );

    if (!nombre) {
        mostrarToast(
            "Ingresa el nombre de la marca",
            "warning"
        );
        return;
    }

    const resultado = await enviarJson(
        `${CONFIG.API_URL}/marcas/crear`,
        {
            nombre: nombre
        },
        "btnAgregarMarca",
        "Creando...",
        "Marca creada correctamente",
        "No se pudo crear la marca"
    );

    if (!resultado) {
        return;
    }

    asignarValorProducto(
        "nuevaMarca",
        ""
    );

    const idCreado = obtenerIdCreado(
        resultado,
        ["idMarca", "id"]
    );

    await cargarComboProducto(
        "MARCA",
        "idMarca",
        "Seleccionar marca",
        idCreado
    );
}

/* =========================================================
   CREAR UNIDAD DE MEDIDA
   POST /unidades-medida/crear
========================================================= */

async function agregarUnidad() {
    const nombre = obtenerValorProducto(
        "nuevaUnidad"
    );

    const abreviatura = obtenerValorProducto(
        "abreviaturaUnidad"
    ).toUpperCase();

    if (!nombre) {
        mostrarToast(
            "Ingresa el nombre de la unidad",
            "warning"
        );
        return;
    }

    if (!abreviatura) {
        mostrarToast(
            "Ingresa la abreviatura de la unidad",
            "warning"
        );
        return;
    }

    const resultado = await enviarJson(
        `${CONFIG.API_URL}/unidades-medida/crear`,
        {
            nombre: nombre,
            abreviatura: abreviatura
        },
        "btnAgregarUnidad",
        "Creando...",
        "Unidad de medida creada correctamente",
        "No se pudo crear la unidad de medida"
    );

    if (!resultado) {
        return;
    }

    asignarValorProducto(
        "nuevaUnidad",
        ""
    );

    asignarValorProducto(
        "abreviaturaUnidad",
        ""
    );
}

/* =========================================================
   CREAR VARIANTE
   POST /variantes
========================================================= */

async function agregarVariante() {
    const idProducto = Number(
        obtenerValorProducto(
            "idProductoVariante"
        )
    );

    const descripcion = obtenerValorProducto(
        "descripcionVariante"
    );

    if (
        !Number.isInteger(idProducto) ||
        idProducto <= 0
    ) {
        mostrarToast(
            "Selecciona un producto",
            "warning"
        );
        return;
    }

    if (!descripcion) {
        mostrarToast(
            "Ingresa la descripción de la variante",
            "warning"
        );
        return;
    }

    const resultado = await enviarJson(
        `${CONFIG.API_URL}/variantes`,
        {
            descripcion: descripcion,
            idProducto: idProducto
        },
        "btnAgregarVariante",
        "Creando...",
        "Variante creada correctamente",
        "No se pudo crear la variante"
    );

    if (!resultado) {
        return;
    }

    asignarValorProducto(
        "idProductoVariante",
        ""
    );

    asignarValorProducto(
        "descripcionVariante",
        ""
    );
}

/* =========================================================
   FUNCIÓN GENÉRICA PARA POST JSON
========================================================= */

async function enviarJson(
    url,
    cuerpo,
    botonId,
    textoCargando,
    mensajeExito,
    mensajeError
) {
    const boton = document.getElementById(
        botonId
    );

    const textoOriginal = boton?.innerHTML || "";

    try {
        const token = obtenerToken();

        if (!token) {
            mostrarToast(
                "No se encontró la sesión del usuario",
                "danger"
            );
            return null;
        }

        mostrarCargandoBoton(
            boton,
            textoCargando
        );

        console.log("URL:", url);
        console.log("Datos enviados:", cuerpo);

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(cuerpo)
        });

        const resultado = await obtenerRespuesta(response);

        console.log("Estado HTTP:", response.status);
        console.log("Respuesta:", resultado);

        if (!response.ok) {
            mostrarToast(
                obtenerMensajeError(
                    resultado,
                    mensajeError
                ),
                "danger"
            );
            return null;
        }

        mostrarToast(
            mensajeExito,
            "success"
        );

        /*
         * Si el backend devuelve 200 sin cuerpo,
         * se devuelve un objeto vacío para indicar éxito.
         */
        return resultado ?? {};

    } catch (error) {
        console.error(
            "Error al enviar la petición:",
            error
        );

        mostrarToast(
            "No se pudo conectar con el servidor",
            "danger"
        );

        return null;

    } finally {
        restaurarBoton(
            boton,
            textoOriginal
        );
    }
}

/* =========================================================
   VISTA PREVIA DE IMAGEN
========================================================= */

function mostrarVistaPreviaImagen(event) {
    const archivo = event.target.files?.[0];

    if (!archivo) {
        ocultarVistaPreviaImagen();
        return;
    }

    if (!validarTipoImagen(archivo)) {
        event.target.value = "";

        ocultarVistaPreviaImagen();

        mostrarToast(
            "Selecciona una imagen JPG, JPEG, PNG o WEBP",
            "warning"
        );

        return;
    }

    const tamanioMaximo = 5 * 1024 * 1024;

    if (archivo.size > tamanioMaximo) {
        event.target.value = "";

        ocultarVistaPreviaImagen();

        mostrarToast(
            "La imagen no debe superar los 5 MB",
            "warning"
        );

        return;
    }

    const contenedor = document.getElementById(
        "contenedorVistaPrevia"
    );

    const vistaPrevia = document.getElementById(
        "vistaPreviaImagen"
    );

    if (!contenedor || !vistaPrevia) {
        return;
    }

    const lector = new FileReader();

    lector.onload = function (resultado) {
        vistaPrevia.src = resultado.target.result;

        contenedor.classList.remove(
            "d-none"
        );
    };

    lector.readAsDataURL(archivo);
}

function validarTipoImagen(archivo) {
    const tiposPermitidos = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp"
    ];

    return tiposPermitidos.includes(
        archivo.type
    );
}

function ocultarVistaPreviaImagen() {
    const contenedor = document.getElementById(
        "contenedorVistaPrevia"
    );

    const vistaPrevia = document.getElementById(
        "vistaPreviaImagen"
    );

    if (contenedor) {
        contenedor.classList.add(
            "d-none"
        );
    }

    if (vistaPrevia) {
        vistaPrevia.src = "";
    }
}

/* =========================================================
   LIMPIAR FORMULARIO DEL PRODUCTO
========================================================= */

function limpiarFormularioProducto() {
    const formulario = document.getElementById(
        "formProducto"
    );

    if (formulario) {
        formulario.reset();
    }

    ocultarVistaPreviaImagen();
}

/* =========================================================
   ARCHIVO EXCEL
========================================================= */

function mostrarArchivoSeleccionado() {
    const input = document.getElementById(
        "archivoExcel"
    );

    const mensaje = document.getElementById(
        "archivoSeleccionado"
    );

    const archivo = input?.files?.[0];

    if (!mensaje) {
        return;
    }

    if (!archivo) {
        mensaje.textContent = "";

        mensaje.classList.add(
            "d-none"
        );

        return;
    }

    mensaje.textContent =
        `Archivo seleccionado: ${archivo.name}`;

    mensaje.classList.remove(
        "d-none"
    );
}

function procesarExcel() {
    const input = document.getElementById(
        "archivoExcel"
    );

    const archivo = input?.files?.[0];

    if (!archivo) {
        mostrarToast(
            "Selecciona un archivo Excel",
            "warning"
        );
        return;
    }

    mostrarToast(
        "La importación de Excel todavía no está conectada al backend",
        "info"
    );
}

function descargarPlantilla() {
    mostrarToast(
        "La descarga de la plantilla todavía no está configurada",
        "info"
    );
}

/* =========================================================
   AUXILIARES
========================================================= */

function obtenerToken() {
    const dataSesion = CONFIG.getData();

    return dataSesion?.accessToken ?? null;
}

function obtenerValorProducto(id) {
    const elemento = document.getElementById(id);

    return elemento
        ? String(elemento.value).trim()
        : "";
}

function asignarValorProducto(id, valor) {
    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.value = valor ?? "";
    }
}

function obtenerIdCreado(resultado, propiedades) {
    if (
        !resultado ||
        typeof resultado !== "object"
    ) {
        return null;
    }

    for (const propiedad of propiedades) {
        const valor = resultado[propiedad];

        if (
            valor !== null &&
            valor !== undefined
        ) {
            return valor;
        }
    }

    return null;
}

function mostrarCargandoBoton(
    boton,
    texto
) {
    if (!boton) {
        return;
    }

    boton.disabled = true;

    boton.innerHTML = `
        <span
            class="spinner-border spinner-border-sm me-2"
            role="status"
            aria-hidden="true"
        ></span>
        ${texto}
    `;
}

function restaurarBoton(
    boton,
    textoOriginal
) {
    if (!boton) {
        return;
    }

    boton.disabled = false;
    boton.innerHTML = textoOriginal;
}

async function obtenerRespuesta(response) {
    const texto = await response.text();

    if (!texto) {
        return null;
    }

    try {
        return JSON.parse(texto);
    } catch {
        return texto;
    }
}

function obtenerMensajeError(
    resultado,
    mensajeDefecto
) {
    if (
        resultado &&
        typeof resultado === "object"
    ) {
        return (
            resultado.message ||
            resultado.mensaje ||
            resultado.error ||
            resultado.detail ||
            mensajeDefecto
        );
    }

    if (
        typeof resultado === "string" &&
        resultado.trim() !== ""
    ) {
        return resultado;
    }

    return mensajeDefecto;
}

/* =========================================================
   TOAST
========================================================= */

function mostrarToast(
    mensaje,
    tipo = "success"
) {
    const toastElemento = document.getElementById(
        "toastMensaje"
    );

    const textoToast = document.getElementById(
        "textoToast"
    );

    if (!toastElemento || !textoToast) {
        console.log(mensaje);
        return;
    }

    textoToast.textContent = mensaje;

    toastElemento.classList.remove(
        "text-bg-success",
        "text-bg-danger",
        "text-bg-warning",
        "text-bg-info"
    );

    const tiposPermitidos = [
        "success",
        "danger",
        "warning",
        "info"
    ];

    const tipoFinal = tiposPermitidos.includes(tipo)
        ? tipo
        : "info";

    toastElemento.classList.add(
        `text-bg-${tipoFinal}`
    );

    const toast = bootstrap.Toast.getOrCreateInstance(
        toastElemento,
        {
            delay: 2200,
            autohide: true
        }
    );

    toast.show();
}