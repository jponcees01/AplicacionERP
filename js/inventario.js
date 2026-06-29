"use strict";

(function () {

    /* =========================================================
       VALIDAR CONFIGURACIÓN
    ========================================================= */

    if (typeof CONFIG === "undefined") {
        console.error(
            "CONFIG no está disponible. Carga config.js antes de inventario.js."
        );
        return;
    }

    /* =========================================================
       ENDPOINTS
    ========================================================= */

    const ENDPOINTS = {
        inventario:
            `${CONFIG.API_URL}/inventario`,

        productos:
            `${CONFIG.API_URL}/inventario/combo?tipo=PRODUCTO`,

        unidades:
            `${CONFIG.API_URL}/inventario/combo?tipo=UNIDAD_MEDIDA`,

        variantes: (idProducto) =>
            `${CONFIG.API_URL}/variantes/producto/${idProducto}`,

        reabastecimiento:
            `${CONFIG.API_URL}/reabastecimiento/crear`,

        actualizarImagen: (idProducto) =>
            `${CONFIG.API_URL}/productos/${idProducto}/imagen`
    };

    /* =========================================================
       VARIABLES DE ESTADO
    ========================================================= */

    let productosInventario = [];
    let productosCombo = [];
    let unidadesCombo = [];
    let variantesCombo = [];
    let detalleReabastecimiento = [];

    let paginaActual = 0;
    let totalPaginas = 0;
    let totalElementos = 0;

    const tamanioPagina = 10;

    let temporizadorBusqueda = null;

    /* =========================================================
       INICIALIZACIÓN
    ========================================================= */

    document.addEventListener(
        "DOMContentLoaded",
        iniciarInventario
    );

    async function iniciarInventario() {
        configurarEventos();

        try {
            await cargarInventario();
        } catch (error) {
            console.error(
                "Error al cargar inventario:",
                error
            );

            mostrarToast(
                obtenerMensajeError(error),
                "danger"
            );
        }
    }

    function configurarEventos() {
        document
            .getElementById("buscarProducto")
            ?.addEventListener(
                "input",
                function () {

                    clearTimeout(
                        temporizadorBusqueda
                    );

                    temporizadorBusqueda =
                        setTimeout(
                            function () {

                                paginaActual = 0;

                                cargarInventario();
                            },
                            400
                        );
                }
            );

        document
            .getElementById("filtroStock")
            ?.addEventListener(
                "change",
                filtrarProductos
            );

        document
            .getElementById("cantidadProducto")
            ?.addEventListener(
                "input",
                calcularSubtotalFormulario
            );

        document
            .getElementById("costoProducto")
            ?.addEventListener(
                "input",
                calcularSubtotalFormulario
            );
    }

    /* =========================================================
       SESIÓN
    ========================================================= */

    function obtenerDatosSesion() {
        try {
            return CONFIG.getData() || null;
        } catch (error) {
            console.error(
                "No se pudo leer CONFIG.getData():",
                error
            );

            return null;
        }
    }

    function obtenerToken() {
        return obtenerDatosSesion()?.accessToken || null;
    }

    function obtenerIdAlmacen() {
        return Number(
            obtenerDatosSesion()?.idAlmacen || 0
        );
    }

    /* =========================================================
       PETICIONES HTTP
    ========================================================= */

    async function realizarPeticion(
        url,
        opciones = {}
    ) {
        const token = obtenerToken();

        if (!token) {
            throw new Error(
                "No se encontró el token de acceso."
            );
        }

        const headers = {
            Accept: "application/json",

            ...(opciones.body
                ? {
                    "Content-Type": "application/json"
                }
                : {}),

            ...(opciones.headers || {}),

            Authorization: `Bearer ${token}`
        };

        const response = await fetch(url, {
            ...opciones,
            headers
        });

        const contentType =
            response.headers.get("content-type") || "";

        let respuesta;

        if (
            contentType.includes(
                "application/json"
            )
        ) {
            respuesta = await response.json();
        } else {
            respuesta = await response.text();
        }

        if (!response.ok) {
            console.error(
                "Error en petición:",
                {
                    url,
                    status: response.status,
                    respuesta
                }
            );

            if (response.status === 401) {
                throw new Error(
                    "La sesión expiró o el token no es válido."
                );
            }

            if (response.status === 403) {
                throw new Error(
                    "No tienes permisos para acceder a este recurso."
                );
            }

            throw new Error(
                respuesta?.mensaje ||
                respuesta?.message ||
                respuesta?.error ||
                respuesta ||
                `Error HTTP ${response.status}`
            );
        }

        return respuesta;
    }

    /* =========================================================
       CARGAR INVENTARIO
    ========================================================= */

    async function cargarInventario() {

        mostrarCargandoInventario();

        const buscar =
            document
                .getElementById("buscarProducto")
                ?.value
                ?.trim() || "";

        const parametros =
            new URLSearchParams();

        parametros.set(
            "idAlmacen",
            String(obtenerIdAlmacen())
        );

        if (buscar) {

            parametros.set(
                "buscar",
                buscar
            );
        }

        parametros.set(
            "page",
            String(paginaActual)
        );

        parametros.set(
            "size",
            String(tamanioPagina)
        );

        const url =
            `${ENDPOINTS.inventario}?${parametros.toString()}`;

        console.log(
            "URL INVENTARIO:",
            url
        );

        try {

            const respuesta =
                await realizarPeticion(url);

            console.log(
                "RESPUESTA INVENTARIO:",
                respuesta
            );

            productosInventario =
                obtenerListaRespuesta(
                    respuesta
                ).map(
                    normalizarProductoInventario
                );

            paginaActual =
                Number(
                    respuesta?.number ?? 0
                );

            totalPaginas =
                Number(
                    respuesta?.totalPages ?? 0
                );

            totalElementos =
                Number(
                    respuesta?.totalElements ?? 0
                );

            const filtroStock =
                document
                    .getElementById("filtroStock")
                    ?.value || "todos";

            let listaMostrar =
                productosInventario;

            if (filtroStock !== "todos") {

                listaMostrar =
                    productosInventario.filter(
                        function (producto) {

                            return (
                                obtenerEstadoStock(producto).estado ===
                                filtroStock
                            );
                        }
                    );
            }

            renderizarProductos(
                listaMostrar
            );

            actualizarPaginacionInventario();

            await actualizarResumen();

        } catch (error) {

            console.error(
                "Error cargando inventario:",
                error
            );

            productosInventario = [];

            paginaActual = 0;
            totalPaginas = 0;
            totalElementos = 0;

            renderizarProductos([]);

            actualizarPaginacionInventario();

            mostrarToast(
                obtenerMensajeError(error),
                "danger"
            );
        }
    }
    function obtenerListaRespuesta(respuesta) {
        if (Array.isArray(respuesta)) {
            return respuesta;
        }

        if (Array.isArray(respuesta?.content)) {
            return respuesta.content;
        }

        if (Array.isArray(respuesta?.data)) {
            return respuesta.data;
        }

        if (Array.isArray(respuesta?.resultado)) {
            return respuesta.resultado;
        }

        return [];
    }

    /* =========================================================
       CONSTRUIR URL DE IMAGEN
    ========================================================= */

    function construirUrlImagen(ruta) {
        if (!ruta) {
            return "";
        }

        const rutaLimpia =
            String(ruta).trim();

        if (
            rutaLimpia.startsWith("http://") ||
            rutaLimpia.startsWith("https://") ||
            rutaLimpia.startsWith("data:")
        ) {
            return rutaLimpia;
        }

        const rutaNormalizada =
            rutaLimpia.startsWith("/")
                ? rutaLimpia
                : `/${rutaLimpia}`;

        /*
         * CONFIG.API_URL ya contiene:
         * http://localhost:8080/api/v1
         *
         * La URL resultante será:
         * http://localhost:8080/api/v1/uploads/productos/archivo.jpg
         */
        return `${CONFIG.API_URL}${rutaNormalizada}`;
    }

    function mostrarImagenPredeterminada(imagen) {
        const contenedor =
            imagen?.parentElement;

        if (!contenedor) {
            return;
        }

        contenedor.innerHTML = `
            <i class="bi bi-box-seam producto-sin-imagen"></i>
        `;
    }

    /* =========================================================
       NORMALIZAR PRODUCTO
    ========================================================= */

    function normalizarProductoInventario(item) {
        return {
            idInventario:
                Number(
                    item.idInventario ??
                    item.id_inventario ??
                    0
                ),

            idProducto:
                Number(
                    item.idProducto ??
                    item.id_producto ??
                    0
                ),

            nombre:
                item.nombreProducto ??
                item.nombre ??
                item.producto ??
                "Producto sin nombre",

            codigo:
                item.sku ??
                item.codigo ??
                item.codigoBarra ??
                item.codigo_barra ??
                "SIN-CÓDIGO",

            codigoBarra:
                item.codigoBarra ??
                item.codigo_barra ??
                "",

            categoria:
                item.categoria ??
                "Sin categoría",

            marca:
                item.marca ??
                "Sin marca",

            variante:
                item.variante ??
                item.descripcionVariante ??
                item.descripcion_variante ??
                "Sin variante",

            unidad:
                item.unidadMedida ??
                item.unidad_medida ??
                item.unidad ??
                "Sin unidad",

            almacen:
                item.almacen ??
                "Sin almacén",

            stock:
                Number(
                    item.stock ?? 0
                ),

            stockMinimo:
                Number(
                    item.stockMinimo ??
                    item.stock_minimo ??
                    0
                ),

            stockMaximo:
                Number(
                    item.stockMaximo ??
                    item.stock_maximo ??
                    0
                ),

            stockReservado:
                Number(
                    item.stockReservado ??
                    item.stock_reservado ??
                    0
                ),

            precio:
                Number(
                    item.precioVenta ??
                    item.precio_venta ??
                    item.precioUnitario ??
                    item.precio_unitario ??
                    0
                ),

            costo:
                Number(
                    item.costoBase ??
                    item.costo_base ??
                    item.costoPromedio ??
                    item.costo_promedio ??
                    0
                ),

            imagen:
                construirUrlImagen(
                    item.urlImagen ??
                    item.url_imagen ??
                    ""
                )
        };
    }

    function mostrarCargandoInventario() {
        const contenedor =
            document.getElementById(
                "contenedorProductos"
            );

        const sinResultados =
            document.getElementById(
                "sinResultados"
            );

        sinResultados?.classList.add(
            "d-none"
        );

        if (!contenedor) {
            return;
        }

        contenedor.innerHTML = `
            <div class="col-12 text-center py-5">

                <div
                    class="spinner-border text-primary"
                    role="status"
                ></div>

                <p class="text-muted mt-3 mb-0">
                    Cargando inventario...
                </p>

            </div>
        `;
    }

    /* =========================================================
       CARDS DE PRODUCTOS
    ========================================================= */

    function renderizarProductos(listaProductos) {
        const contenedor =
            document.getElementById(
                "contenedorProductos"
            );

        const sinResultados =
            document.getElementById(
                "sinResultados"
            );

        if (!contenedor) {
            return;
        }

        contenedor.innerHTML = "";

        if (
            !listaProductos ||
            listaProductos.length === 0
        ) {
            sinResultados?.classList.remove(
                "d-none"
            );

            return;
        }

        sinResultados?.classList.add(
            "d-none"
        );

        listaProductos.forEach(
            function (producto) {
                const estado =
                    obtenerEstadoStock(
                        producto
                    );

                const columna =
                    document.createElement(
                        "div"
                    );

                columna.className =
                    "col-sm-6 col-xl-4";

                columna.innerHTML = `
                    <div class="card producto-card h-100">

                        <div class="producto-imagen">

                            ${producto.imagen
                        ? `
                                        <img
                                            src="${escaparHtml(producto.imagen)}"
                                            alt="${escaparHtml(producto.nombre)}"
                                            onerror="mostrarImagenPredeterminada(this)"
                                        >
                                    `
                        : `
                                        <i
                                            class="bi bi-box-seam producto-sin-imagen"
                                        ></i>
                                    `
                    }

                        </div>

                        <div class="card-body p-4">

                            <div
                                class="d-flex justify-content-between align-items-start gap-2 mb-2"
                            >

                                <span class="producto-codigo">
                                    ${escaparHtml(producto.codigo)}
                                </span>

                                <span
                                    class="badge-stock ${estado.claseBadge}"
                                >
                                    ${estado.texto}
                                </span>

                            </div>

                            <h5 class="producto-nombre">
                                ${escaparHtml(producto.nombre)}
                            </h5>

                            <div class="producto-detalle">
                                <span>Variante</span>

                                <strong>
                                    ${escaparHtml(producto.variante)}
                                </strong>
                            </div>

                            <div class="producto-detalle">
                                <span>Categoría</span>

                                <strong>
                                    ${escaparHtml(producto.categoria)}
                                </strong>
                            </div>

                            <div class="producto-detalle">
                                <span>Marca</span>

                                <strong>
                                    ${escaparHtml(producto.marca)}
                                </strong>
                            </div>

                            <div class="producto-detalle">
                                <span>Unidad</span>

                                <strong>
                                    ${escaparHtml(producto.unidad)}
                                </strong>
                            </div>

                            <div class="producto-detalle">
                                <span>Almacén</span>

                                <strong>
                                    ${escaparHtml(producto.almacen)}
                                </strong>
                            </div>

                            <div class="producto-detalle">
                                <span>Precio</span>

                                <strong>
                                    ${formatearMoneda(producto.precio)}
                                </strong>
                            </div>

                            <div class="stock-contenedor mt-3">

                                <div
                                    class="d-flex justify-content-between align-items-center"
                                >

                                    <div>

                                        <small class="text-muted">
                                            Stock disponible
                                        </small>

                                        <div
                                            class="stock-numero ${estado.claseStock}"
                                        >
                                            ${producto.stock}
                                        </div>

                                    </div>

                                    <div class="text-end">

                                        <small class="text-muted">
                                            Stock mínimo
                                        </small>

                                        <div class="fw-bold">
                                            ${producto.stockMinimo}
                                        </div>

                                    </div>

                                </div>

                            </div>

                        </div>

                    </div>
                `;

                contenedor.appendChild(
                    columna
                );
            }
        );
    }

    function obtenerEstadoStock(producto) {
        if (producto.stock <= 0) {
            return {
                texto: "Agotado",
                claseBadge:
                    "bg-danger-subtle text-danger",
                claseStock:
                    "stock-agotado",
                estado:
                    "agotado"
            };
        }

        if (
            producto.stock <=
            producto.stockMinimo
        ) {
            return {
                texto: "Stock bajo",
                claseBadge:
                    "bg-warning-subtle text-warning",
                claseStock:
                    "stock-bajo",
                estado:
                    "bajo"
            };
        }

        return {
            texto: "Disponible",
            claseBadge:
                "bg-success-subtle text-success",
            claseStock:
                "stock-disponible",
            estado:
                "disponible"
        };
    }

    /* =========================================================
       FILTROS
    ========================================================= */

    function filtrarProductos() {
        const texto =
            document
                .getElementById(
                    "buscarProducto"
                )
                ?.value
                ?.toLowerCase()
                ?.trim() || "";

        const filtro =
            document
                .getElementById(
                    "filtroStock"
                )
                ?.value || "todos";

        const productosFiltrados =
            productosInventario.filter(
                function (producto) {
                    const contenido = `
                        ${producto.nombre}
                        ${producto.codigo}
                        ${producto.codigoBarra}
                        ${producto.variante}
                        ${producto.categoria}
                        ${producto.marca}
                        ${producto.unidad}
                        ${producto.almacen}
                    `.toLowerCase();

                    const coincideTexto =
                        contenido.includes(texto);

                    const estadoProducto =
                        obtenerEstadoStock(
                            producto
                        ).estado;

                    const coincideEstado =
                        filtro === "todos" ||
                        filtro === estadoProducto;

                    return (
                        coincideTexto &&
                        coincideEstado
                    );
                }
            );

        renderizarProductos(
            productosFiltrados
        );
    }

    function limpiarFiltros() {
        asignarValor(
            "buscarProducto",
            ""
        );

        asignarValor(
            "filtroStock",
            "todos"
        );

        renderizarProductos(
            productosInventario
        );
    }

    /* =========================================================
       RESUMEN
    ========================================================= */

    async function actualizarResumen() {
        try {
            const url = `${CONFIG.API_URL}/inventario/dashboard?idAlmacen=${CONFIG.getData().idAlmacen}`;

            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Accept": "application/json",
                    "Authorization": `Bearer ${CONFIG.getData().accessToken}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Error resumen:", data);
                return;
            }

            console.log("RESUMEN BACKEND:", data);

            document.getElementById("totalProductos").textContent = data.totalProductos;

            document.getElementById("productosStockBajo").textContent = data.productosStockBajo;

            document.getElementById("productosSinStock").textContent = data.productosAgotados;

        } catch (error) {

        }
    }

    /* =========================================================
       PREPARAR MODAL
    ========================================================= */

    async function prepararReabastecimiento() {
        detalleReabastecimiento = [];

        limpiarFormularioProducto();
        limpiarDatosGenerales();
        renderizarDetalleReabastecimiento();

        try {
            await Promise.all([
                cargarProductosCombo(),
                cargarUnidadesCombo()
            ]);
        } catch (error) {
            console.error(
                "Error al preparar reabastecimiento:",
                error
            );

            mostrarToast(
                obtenerMensajeError(error),
                "danger"
            );
        }
    }

    /* =========================================================
       COMBOS
    ========================================================= */

    async function cargarProductosCombo() {
        const select =
            document.getElementById(
                "productoSeleccionado"
            );

        bloquearSelect(
            select,
            "Cargando productos..."
        );

        try {
            const respuesta =
                await realizarPeticion(
                    ENDPOINTS.productos
                );

            productosCombo =
                normalizarCombo(
                    respuesta
                );

            llenarSelect(
                select,
                productosCombo,
                "Seleccionar producto"
            );

            select.disabled = false;

        } catch (error) {
            bloquearSelect(
                select,
                "No se pudieron cargar los productos"
            );

            throw error;
        }
    }

    async function cargarUnidadesCombo() {
        const select =
            document.getElementById(
                "unidadSeleccionada"
            );

        bloquearSelect(
            select,
            "Cargando unidades..."
        );

        try {
            const respuesta =
                await realizarPeticion(
                    ENDPOINTS.unidades
                );

            unidadesCombo =
                normalizarCombo(
                    respuesta
                );

            llenarSelect(
                select,
                unidadesCombo,
                "Seleccionar unidad"
            );

            select.disabled = false;

        } catch (error) {
            bloquearSelect(
                select,
                "No se pudieron cargar las unidades"
            );

            throw error;
        }
    }

    async function cargarVariantesProducto() {
        const productoSelect =
            document.getElementById(
                "productoSeleccionado"
            );

        const varianteSelect =
            document.getElementById(
                "varianteSeleccionada"
            );

        const idProducto =
            Number(
                productoSelect?.value
            );

        variantesCombo = [];

        if (!idProducto) {
            bloquearSelect(
                varianteSelect,
                "Primero selecciona un producto"
            );

            return;
        }

        bloquearSelect(
            varianteSelect,
            "Cargando variantes..."
        );

        try {
            const respuesta =
                await realizarPeticion(
                    ENDPOINTS.variantes(
                        idProducto
                    )
                );

            const lista =
                obtenerListaRespuesta(
                    respuesta
                );

            variantesCombo =
                lista
                    .filter(
                        function (item) {
                            return (
                                item.estado === true ||
                                item.estado === undefined
                            );
                        }
                    )
                    .map(
                        function (item) {
                            return {
                                id:
                                    Number(
                                        item.id ??
                                        item.idProductoVariante
                                    ),

                                texto:
                                    item.descripcion ??
                                    item.texto ??
                                    "Sin descripción"
                            };
                        }
                    )
                    .filter(
                        function (item) {
                            return (
                                Number.isFinite(
                                    item.id
                                ) &&
                                item.id > 0
                            );
                        }
                    );

            if (
                variantesCombo.length === 0
            ) {
                bloquearSelect(
                    varianteSelect,
                    "El producto no tiene variantes"
                );

                return;
            }

            llenarSelect(
                varianteSelect,
                variantesCombo,
                "Seleccionar variante"
            );

            varianteSelect.disabled = false;

        } catch (error) {
            bloquearSelect(
                varianteSelect,
                "No se pudieron cargar las variantes"
            );

            mostrarToast(
                obtenerMensajeError(error),
                "danger"
            );
        }
    }

    function normalizarCombo(respuesta) {
        const lista =
            obtenerListaRespuesta(
                respuesta
            );

        return lista
            .map(
                function (item) {
                    return {
                        id:
                            Number(
                                item.id ??
                                item.idProducto ??
                                item.idUnidadMedida
                            ),

                        texto:
                            item.texto ??
                            item.nombre ??
                            item.descripcion ??
                            item.abreviatura ??
                            "Sin descripción"
                    };
                }
            )
            .filter(
                function (item) {
                    return (
                        Number.isFinite(
                            item.id
                        ) &&
                        item.id > 0
                    );
                }
            );
    }

    function llenarSelect(
        select,
        elementos,
        textoInicial
    ) {
        if (!select) {
            return;
        }

        select.innerHTML = "";

        const opcionInicial =
            document.createElement(
                "option"
            );

        opcionInicial.value = "";
        opcionInicial.textContent =
            textoInicial;

        select.appendChild(
            opcionInicial
        );

        elementos.forEach(
            function (elemento) {
                const opcion =
                    document.createElement(
                        "option"
                    );

                opcion.value =
                    elemento.id;

                opcion.textContent =
                    elemento.texto;

                select.appendChild(
                    opcion
                );
            }
        );
    }

    function bloquearSelect(
        select,
        mensaje
    ) {
        if (!select) {
            return;
        }

        select.disabled = true;
        select.innerHTML = "";

        const opcion =
            document.createElement(
                "option"
            );

        opcion.value = "";
        opcion.textContent = mensaje;

        select.appendChild(
            opcion
        );
    }

    /* =========================================================
       AGREGAR PRODUCTO
    ========================================================= */

    function agregarProductoReabastecimiento() {
        const productoSelect =
            document.getElementById(
                "productoSeleccionado"
            );

        const varianteSelect =
            document.getElementById(
                "varianteSeleccionada"
            );

        const unidadSelect =
            document.getElementById(
                "unidadSeleccionada"
            );

        const item = {
            idProducto:
                Number(
                    productoSelect?.value
                ),

            idProductoVariante:
                Number(
                    varianteSelect?.value
                ),

            idUnidadMedida:
                Number(
                    unidadSelect?.value
                ),

            producto:
                obtenerTextoSeleccionado(
                    productoSelect
                ),

            variante:
                obtenerTextoSeleccionado(
                    varianteSelect
                ),

            unidadMedida:
                obtenerTextoSeleccionado(
                    unidadSelect
                ),

            cantidad:
                obtenerNumero(
                    "cantidadProducto"
                ),

            costoUnitario:
                obtenerNumero(
                    "costoProducto"
                ),

            precioVenta:
                obtenerNumero(
                    "precioVentaProducto"
                ),

            stockMinimo:
                obtenerNumero(
                    "stockMinimoProducto"
                ),

            stockMaximo:
                obtenerNumero(
                    "stockMaximoProducto"
                ),

            puntoReorden:
                obtenerNumero(
                    "puntoReordenProducto"
                )
        };

        const error =
            validarDetalle(item);

        if (error) {
            mostrarToast(
                error,
                "warning"
            );

            return;
        }

        const duplicado =
            detalleReabastecimiento.some(
                function (detalle) {
                    return (
                        detalle.idProductoVariante ===
                        item.idProductoVariante &&
                        detalle.idUnidadMedida ===
                        item.idUnidadMedida
                    );
                }
            );

        if (duplicado) {
            mostrarToast(
                "La variante con esa unidad ya fue agregada.",
                "warning"
            );

            return;
        }

        item.subtotal =
            item.cantidad *
            item.costoUnitario;

        detalleReabastecimiento.push(
            item
        );

        renderizarDetalleReabastecimiento();
        limpiarFormularioProducto();

        mostrarToast(
            "Producto agregado al detalle.",
            "success"
        );
    }

    function validarDetalle(item) {
        if (!item.idProducto) {
            return "Selecciona un producto.";
        }

        if (!item.idProductoVariante) {
            return "Selecciona una variante.";
        }

        if (!item.idUnidadMedida) {
            return "Selecciona una unidad.";
        }

        if (
            !Number.isInteger(
                item.cantidad
            ) ||
            item.cantidad <= 0
        ) {
            return "La cantidad debe ser mayor que cero.";
        }

        if (
            !Number.isFinite(
                item.costoUnitario
            ) ||
            item.costoUnitario < 0
        ) {
            return "El costo unitario no es válido.";
        }

        if (
            !Number.isFinite(
                item.precioVenta
            ) ||
            item.precioVenta < 0
        ) {
            return "El precio de venta no es válido.";
        }

        if (
            item.precioVenta <
            item.costoUnitario
        ) {
            return "El precio de venta no puede ser menor que el costo.";
        }

        if (
            !Number.isInteger(
                item.stockMinimo
            ) ||
            item.stockMinimo < 0
        ) {
            return "El stock mínimo no es válido.";
        }

        if (
            !Number.isInteger(
                item.stockMaximo
            ) ||
            item.stockMaximo <= 0
        ) {
            return "El stock máximo debe ser mayor que cero.";
        }

        if (
            item.stockMinimo >
            item.stockMaximo
        ) {
            return "El stock mínimo no puede superar el stock máximo.";
        }

        if (
            !Number.isInteger(
                item.puntoReorden
            ) ||
            item.puntoReorden < 0 ||
            item.puntoReorden >
            item.stockMaximo
        ) {
            return "El punto de reorden no es válido.";
        }

        return null;
    }

    /* =========================================================
       TABLA DEL MODAL
    ========================================================= */

    function renderizarDetalleReabastecimiento() {
        const tabla =
            document.getElementById(
                "tablaReabastecimiento"
            );

        if (!tabla) {
            return;
        }

        if (
            detalleReabastecimiento.length === 0
        ) {
            tabla.innerHTML = `
                <tr>
                    <td
                        colspan="11"
                        class="text-center py-5 text-muted"
                    >
                        <i class="bi bi-cart-plus fs-1 d-block mb-2"></i>
                        Todavía no has agregado productos.
                    </td>
                </tr>
            `;

            actualizarTotalReabastecimiento();

            return;
        }

        tabla.innerHTML =
            detalleReabastecimiento
                .map(
                    function (
                        detalle,
                        indice
                    ) {
                        return `
                            <tr>

                                <td>
                                    ${escaparHtml(detalle.producto)}
                                </td>

                                <td>
                                    ${escaparHtml(detalle.variante)}
                                </td>

                                <td>
                                    ${escaparHtml(detalle.unidadMedida)}
                                </td>

                                <td class="text-center">

                                    <input
                                        type="number"
                                        class="form-control form-control-sm"
                                        min="1"
                                        value="${detalle.cantidad}"
                                        onchange="
                                            actualizarCantidadDetalle(
                                                ${indice},
                                                this.value
                                            )
                                        "
                                    >

                                </td>

                                <td class="text-end">
                                    ${formatearMoneda(detalle.costoUnitario)}
                                </td>

                                <td class="text-end">
                                    ${formatearMoneda(detalle.precioVenta)}
                                </td>

                                <td class="text-center">
                                    ${detalle.stockMinimo}
                                </td>

                                <td class="text-center">
                                    ${detalle.stockMaximo}
                                </td>

                                <td class="text-center">
                                    ${detalle.puntoReorden}
                                </td>

                                <td class="text-end fw-bold">
                                    ${formatearMoneda(detalle.subtotal)}
                                </td>

                                <td class="text-center">

                                    <button
                                        type="button"
                                        class="btn btn-sm btn-outline-danger"
                                        onclick="eliminarProductoDetalle(${indice})"
                                    >
                                        <i class="bi bi-trash"></i>
                                    </button>

                                </td>

                            </tr>
                        `;
                    }
                )
                .join("");

        actualizarTotalReabastecimiento();
    }

    function actualizarCantidadDetalle(
        indice,
        nuevaCantidad
    ) {
        const cantidad =
            Number(nuevaCantidad);

        if (
            !Number.isInteger(cantidad) ||
            cantidad <= 0
        ) {
            mostrarToast(
                "La cantidad debe ser mayor que cero.",
                "warning"
            );

            renderizarDetalleReabastecimiento();

            return;
        }

        const detalle =
            detalleReabastecimiento[indice];

        if (!detalle) {
            return;
        }

        detalle.cantidad = cantidad;

        detalle.subtotal =
            cantidad *
            detalle.costoUnitario;

        renderizarDetalleReabastecimiento();
    }

    function eliminarProductoDetalle(indice) {
        detalleReabastecimiento.splice(
            indice,
            1
        );

        renderizarDetalleReabastecimiento();
    }

    function actualizarTotalReabastecimiento() {
        const total =
            detalleReabastecimiento.reduce(
                function (
                    acumulado,
                    detalle
                ) {
                    return (
                        acumulado +
                        detalle.subtotal
                    );
                },
                0
            );

        asignarTexto(
            "totalReabastecimiento",
            formatearMoneda(total)
        );
    }

    /* =========================================================
       CONFIRMAR REABASTECIMIENTO
    ========================================================= */

    async function confirmarReabastecimiento() {
        if (
            detalleReabastecimiento.length === 0
        ) {
            mostrarToast(
                "Debes agregar al menos un producto.",
                "warning"
            );

            return;
        }

        const idAlmacen =
            obtenerIdAlmacen();

        if (!idAlmacen) {
            mostrarToast(
                "No se encontró idAlmacen en CONFIG.getData().",
                "danger"
            );

            return;
        }

        const proveedor =
            document
                .getElementById(
                    "proveedor"
                )
                ?.value
                ?.trim() || "";

        const observacionFormulario =
            document
                .getElementById(
                    "observacion"
                )
                ?.value
                ?.trim() || "";

        const request = {
            idAlmacen,

            observacion:
                construirObservacion(
                    proveedor,
                    observacionFormulario
                ),

            detalle:
                detalleReabastecimiento.map(
                    function (detalle) {
                        return {
                            idProducto:
                                detalle.idProducto,

                            idProductoVariante:
                                detalle.idProductoVariante,

                            idUnidadMedida:
                                detalle.idUnidadMedida,

                            cantidad:
                                detalle.cantidad,

                            costoUnitario:
                                detalle.costoUnitario,

                            precioVenta:
                                detalle.precioVenta,

                            stockMinimo:
                                detalle.stockMinimo,

                            stockMaximo:
                                detalle.stockMaximo,

                            puntoReorden:
                                detalle.puntoReorden
                        };
                    }
                )
        };

        console.log(
            "Reabastecimiento enviado:",
            request
        );

        const boton =
            document.getElementById(
                "btnConfirmarReabastecimiento"
            );

        cambiarEstadoBoton(
            boton,
            true
        );

        try {
            const respuesta =
                await realizarPeticion(
                    ENDPOINTS.reabastecimiento,
                    {
                        method: "POST",

                        body:
                            JSON.stringify(
                                request
                            )
                    }
                );

            mostrarToast(
                respuesta?.mensaje ||
                "Reabastecimiento registrado correctamente.",
                "success"
            );

            if (typeof actualizarAlertasGlobales === "function") {
                actualizarAlertasGlobales();
            }

            detalleReabastecimiento = [];

            renderizarDetalleReabastecimiento();

            const modal =
                document.getElementById(
                    "modalReabastecimiento"
                );

            bootstrap.Modal
                .getInstance(modal)
                ?.hide();

            await cargarInventario();

        } catch (error) {
            console.error(
                "Error registrando reabastecimiento:",
                error
            );

            mostrarToast(
                obtenerMensajeError(error),
                "danger"
            );

        } finally {
            cambiarEstadoBoton(
                boton,
                false
            );
        }
    }

    /* =========================================================
       LIMPIEZA
    ========================================================= */

    function limpiarFormularioProducto() {
        asignarValor(
            "productoSeleccionado",
            ""
        );

        bloquearSelect(
            document.getElementById(
                "varianteSeleccionada"
            ),
            "Primero selecciona un producto"
        );

        asignarValor(
            "unidadSeleccionada",
            ""
        );

        asignarValor(
            "cantidadProducto",
            ""
        );

        asignarValor(
            "costoProducto",
            ""
        );

        asignarValor(
            "precioVentaProducto",
            ""
        );

        asignarValor(
            "stockMinimoProducto",
            5
        );

        asignarValor(
            "stockMaximoProducto",
            100
        );

        asignarValor(
            "puntoReordenProducto",
            20
        );

        asignarValor(
            "subtotalProducto",
            "0.00"
        );
    }

    function limpiarDatosGenerales() {
        asignarValor(
            "proveedor",
            ""
        );

        asignarValor(
            "observacion",
            ""
        );
    }

    function calcularSubtotalFormulario() {
        const cantidad =
            obtenerNumero(
                "cantidadProducto"
            );

        const costo =
            obtenerNumero(
                "costoProducto"
            );

        const subtotal =
            Math.max(cantidad, 0) *
            Math.max(costo, 0);

        asignarValor(
            "subtotalProducto",
            subtotal.toFixed(2)
        );
    }

    /* =========================================================
       UTILIDADES
    ========================================================= */

    function construirObservacion(
        proveedor,
        observacion
    ) {
        const partes = [];

        if (proveedor) {
            partes.push(
                `Proveedor: ${proveedor}`
            );
        }

        if (observacion) {
            partes.push(
                observacion
            );
        }

        return partes.length > 0
            ? partes.join(" | ")
            : "Reabastecimiento de inventario";
    }

    function obtenerTextoSeleccionado(select) {
        if (
            !select ||
            !select.value ||
            select.selectedIndex < 0
        ) {
            return "";
        }

        return select.options[
            select.selectedIndex
        ].textContent.trim();
    }

    function obtenerNumero(id) {
        const elemento =
            document.getElementById(id);

        if (
            !elemento ||
            elemento.value === ""
        ) {
            return 0;
        }

        return Number(
            elemento.value
        );
    }

    function asignarValor(
        id,
        valor
    ) {
        const elemento =
            document.getElementById(id);

        if (elemento) {
            elemento.value = valor;
        }
    }

    function asignarTexto(
        id,
        texto
    ) {
        const elemento =
            document.getElementById(id);

        if (elemento) {
            elemento.textContent = texto;
        }
    }

    function cambiarEstadoBoton(
        boton,
        procesando
    ) {
        if (!boton) {
            return;
        }

        boton.disabled = procesando;

        boton.innerHTML =
            procesando
                ? `
                    <span
                        class="spinner-border spinner-border-sm me-2"
                    ></span>

                    Procesando...
                `
                : `
                    <i
                        class="bi bi-check-circle me-2"
                    ></i>

                    Confirmar reabastecimiento
                `;
    }

    function mostrarToast(
        mensaje,
        tipo = "success"
    ) {
        const toastElemento =
            document.getElementById(
                "toastMensaje"
            );

        const textoToast =
            document.getElementById(
                "textoToast"
            );

        if (
            !toastElemento ||
            !textoToast
        ) {
            alert(mensaje);
            return;
        }

        toastElemento.classList.remove(
            "text-bg-success",
            "text-bg-danger",
            "text-bg-warning",
            "text-bg-info"
        );

        toastElemento.classList.add(
            `text-bg-${tipo}`
        );

        textoToast.textContent = mensaje;

        bootstrap.Toast
            .getOrCreateInstance(
                toastElemento
            )
            .show();
    }

    function obtenerMensajeError(error) {
        return (
            error?.message ||
            "Ocurrió un error inesperado."
        );
    }

    function formatearMoneda(valor) {
        return new Intl.NumberFormat(
            "es-PE",
            {
                style: "currency",
                currency: "PEN",
                minimumFractionDigits: 2
            }
        ).format(
            Number(valor) || 0
        );
    }

    function escaparHtml(valor) {
        return String(
            valor ?? ""
        )
            .replaceAll(
                "&",
                "&amp;"
            )
            .replaceAll(
                "<",
                "&lt;"
            )
            .replaceAll(
                ">",
                "&gt;"
            )
            .replaceAll(
                '"',
                "&quot;"
            )
            .replaceAll(
                "'",
                "&#039;"
            );
    }

    function actualizarPaginacionInventario() {

        const paginaVisible =
            paginaActual + 1;

        asignarTexto(
            "paginaActual",
            totalPaginas > 0
                ? paginaVisible
                : 1
        );

        asignarTexto(
            "textoPaginacion",
            totalPaginas > 0
                ? `Página ${paginaVisible} de ${totalPaginas} - ${totalElementos} registros`
                : "Sin registros"
        );

        document
            .getElementById(
                "itemPaginaAnterior"
            )
            ?.classList
            .toggle(
                "disabled",
                paginaActual <= 0
            );

        document
            .getElementById(
                "itemPaginaSiguiente"
            )
            ?.classList
            .toggle(
                "disabled",
                totalPaginas === 0 ||
                paginaActual >= totalPaginas - 1
            );
    }


    async function cambiarPaginaInventario(
        cambio
    ) {

        const nuevaPagina =
            paginaActual +
            Number(cambio);

        if (
            nuevaPagina < 0 ||
            nuevaPagina >= totalPaginas
        ) {
            return;
        }

        paginaActual =
            nuevaPagina;

        await cargarInventario();
    }

    /* =========================================================
       FUNCIONES EXPUESTAS AL HTML
    ========================================================= */

    window.prepararReabastecimiento =
        prepararReabastecimiento;

    window.cargarVariantesProducto =
        cargarVariantesProducto;

    window.agregarProductoReabastecimiento =
        agregarProductoReabastecimiento;

    window.actualizarCantidadDetalle =
        actualizarCantidadDetalle;

    window.eliminarProductoDetalle =
        eliminarProductoDetalle;

    window.confirmarReabastecimiento =
        confirmarReabastecimiento;

    window.limpiarFiltros =
        limpiarFiltros;

    window.mostrarImagenPredeterminada =
        mostrarImagenPredeterminada;

    window.cambiarPaginaInventario =
        cambiarPaginaInventario;

})();
