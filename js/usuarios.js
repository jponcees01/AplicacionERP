let usuariosCargados = [];
let paginaActual = 0;
let tamanioPagina = 10;
let temporizadorBusqueda = null;
let idProductoSeleccionadoImagen = null;

/* =========================================================
   INICIALIZACIÓN
========================================================= */

document.addEventListener("DOMContentLoaded", async function () {
    await cargarCombo("ROL", "idRol");
    await cargarCombo("ALMACEN", "idAlmacen");
    await cargarCombo("ROL", "filtroRol", true);

    configurarFiltrosUsuarios();
    configurarTamanioPagina();

    obtenerResumenUsuarios();

    await listarUsuarios(
        obtenerEstadoSeleccionado(),
        obtenerTextoBusqueda(),
        0,
        tamanioPagina
    );
});

/* =========================================================
   CARGAR COMBOS
========================================================= */

async function cargarCombo(
    tipo,
    selectId,
    opcionTodos = false
) {
    try {
        const dataSesion = CONFIG.getData();
        const token = dataSesion?.accessToken;

        if (!token) {
            console.error("No se encontró el accessToken");
            return;
        }

        const parametros = new URLSearchParams();
        parametros.append("tipo", tipo);

        const url =
            `${CONFIG.API_URL}/inventario/combo?${parametros.toString()}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });

        const result =
            await obtenerRespuesta(response);

        console.log(`Combo ${tipo}:`, result);

        if (!response.ok) {
            console.error(
                obtenerMensajeError(
                    result,
                    `No se pudo cargar el combo ${tipo}`
                )
            );
            return;
        }

        llenarSelect(
            selectId,
            Array.isArray(result) ? result : [],
            tipo,
            opcionTodos
        );

    } catch (error) {
        console.error(
            `Error al cargar el combo ${tipo}:`,
            error
        );
    }
}

function llenarSelect(
    selectId,
    opciones,
    tipo,
    opcionTodos = false
) {
    const select =
        document.getElementById(selectId);

    if (!select) {
        return;
    }

    select.innerHTML = opcionTodos
        ? `<option value="">Todos</option>`
        : `
            <option value="">
                Seleccionar ${tipo.toLowerCase()}
            </option>
        `;

    opciones.forEach(function (opcion) {
        const option =
            document.createElement("option");

        option.value = opcion.id;
        option.textContent = opcion.texto;

        select.appendChild(option);
    });
}

/* =========================================================
   LISTAR USUARIOS
========================================================= */

async function listarUsuarios(
    estado = null,
    texto = "",
    page = 0,
    size = tamanioPagina
) {
    try {
        const dataSesion = CONFIG.getData();
        const token = dataSesion?.accessToken;

        if (!token) {
            mostrarMensajeTabla(
                "No se encontró la sesión del usuario"
            );
            return;
        }

        const parametros =
            new URLSearchParams();

        if (estado !== null) {
            parametros.append(
                "estado",
                estado
            );
        }

        if (
            texto !== null &&
            texto.trim() !== ""
        ) {
            parametros.append(
                "texto",
                texto.trim()
            );
        }

        parametros.append(
            "page",
            page
        );

        parametros.append(
            "size",
            size
        );

        /*
         * Se agrega un parámetro temporal para evitar que el navegador
         * reutilice una respuesta anterior.
         */
        parametros.append(
            "_t",
            Date.now()
        );

        const url =
            `${CONFIG.API_URL}/usuarios?${parametros.toString()}`;

        console.log(
            "URL usuarios:",
            url
        );

        const response = await fetch(
            url,
            {
                method: "GET",

                headers: {
                    "Accept":
                        "application/json",

                    "Authorization":
                        `Bearer ${token}`
                },

                cache: "no-store"
            }
        );

        const result =
            await obtenerRespuesta(
                response
            );

        console.log(
            "Respuesta de usuarios:",
            result
        );

        if (!response.ok) {
            mostrarToast(
                obtenerMensajeError(
                    result,
                    "No se pudieron cargar los usuarios"
                ),
                "danger"
            );

            mostrarMensajeTabla(
                "No se pudieron cargar los usuarios"
            );

            limpiarInformacionPaginacion();
            limpiarPaginacion();

            return;
        }

        const usuarios =
            result?.content ??
            result?.data ??
            result?.usuarios ??
            [];

        usuariosCargados =
            Array.isArray(usuarios)
                ? [...usuarios]
                : [];

        paginaActual =
            Number(
                result?.number ?? page
            );

        tamanioPagina =
            Number(
                result?.size ?? size
            );

        sincronizarSelectorTamanio();

        /*
         * Se vuelve a pintar explícitamente la tabla.
         * Antes dependías únicamente de aplicarFiltroRolLocal().
         */
        const idRolSeleccionado =
            obtenerRolSeleccionado();

        if (idRolSeleccionado) {
            aplicarFiltroRolLocal();
        } else {
            mostrarUsuarios(
                usuariosCargados
            );
        }

        mostrarPaginacionUsuarios(
            result
        );

        actualizarInformacionPaginacion(
            result
        );

    } catch (error) {
        console.error(
            "Error al consultar usuarios:",
            error
        );

        mostrarMensajeTabla(
            "Error al consultar los usuarios"
        );

        limpiarInformacionPaginacion();
        limpiarPaginacion();

        mostrarToast(
            "No se pudo conectar con el servidor",
            "danger"
        );
    }
}


/* =========================================================
   MOSTRAR USUARIOS
========================================================= */

function mostrarUsuarios(usuarios) {
    const tabla =
        document.getElementById(
            "tablaUsuarios"
        );

    const sinUsuarios =
        document.getElementById(
            "sinUsuarios"
        );

    if (!tabla) {
        console.error(
            "No existe el tbody con id tablaUsuarios"
        );
        return;
    }

    tabla.innerHTML = "";

    if (
        !Array.isArray(usuarios) ||
        usuarios.length === 0
    ) {
        mostrarMensajeTabla(
            "No se encontraron usuarios"
        );

        if (sinUsuarios) {
            sinUsuarios.classList.remove(
                "d-none"
            );
        }

        return;
    }

    if (sinUsuarios) {
        sinUsuarios.classList.add(
            "d-none"
        );
    }

    usuarios.forEach(function (usuario) {
        const nombreCompleto =
            construirNombreCompleto(usuario);

        const rol =
            obtenerNombreRol(usuario);

        const almacen =
            obtenerNombreAlmacen(usuario);

        const usernameSeguro =
            escaparTexto(
                usuario.username || ""
            );

        const fila =
            document.createElement("tr");

        fila.innerHTML = `
            <td>
                ${usuario.username || "-"}
            </td>

            <td>
                ${nombreCompleto || "-"}
            </td>

            <td>
                ${usuario.correo || "-"}
            </td>

            <td>
                ${rol}
            </td>

            <td>
                ${almacen}
            </td>

            <td>
                ${usuario.estado
                ? `
                            <span class="badge bg-success">
                                Activo
                            </span>
                        `
                : `
                            <span class="badge bg-danger">
                                Inactivo
                            </span>
                        `
            }
            </td>

            <td class="text-center">
                <div
                    class="d-flex justify-content-center gap-2"
                >
                    <button
                        type="button"
                        class="btn btn-sm btn-outline-primary"
                        title="Editar usuario"
                        onclick="editarUsuario(
                            ${usuario.idUsuario}
                        )"
                    >
                        <i class="bi bi-pencil"></i>
                    </button>

                    ${usuario.estado
                ? `
                                <button
                                    type="button"
                                    class="btn btn-sm btn-outline-danger"
                                    title="Deshabilitar usuario"
                                    onclick="deshabilitarUsuario(
                                        ${usuario.idUsuario},
                                        '${usernameSeguro}'
                                    )"
                                >
                                    <i class="bi bi-person-x"></i>
                                </button>
                            `
                : `
                                <button
                                    type="button"
                                    class="btn btn-sm btn-outline-success"
                                    title="Habilitar usuario"
                                    onclick="habilitarUsuario(
                                        ${usuario.idUsuario},
                                        '${usernameSeguro}'
                                    )"
                                >
                                    <i class="bi bi-person-check"></i>
                                </button>
                            `
            }
                </div>
            </td>
        `;

        tabla.appendChild(fila);
    });
}

function setDashboardUsuarios(data) {

    document.getElementById("totalUsuarios").textContent =
        data.totalUsuarios ?? 0;

    document.getElementById("totalActivos").textContent =
        data.activos ?? 0;

    document.getElementById("totalInactivos").textContent =
        data.inactivos ?? 0;

    document.getElementById("totalAdministradores").textContent =
        data.administradores ?? 0;
}

function construirNombreCompleto(usuario) {
    return [
        usuario.primerNombre,
        usuario.segundoNombre,
        usuario.apellidoPaterno,
        usuario.apellidoMaterno
    ]
        .filter(Boolean)
        .join(" ")
        .trim();
}

function obtenerNombreRol(usuario) {
    if (
        usuario.rol &&
        typeof usuario.rol === "object"
    ) {
        return (
            usuario.rol.nombre ||
            usuario.rol.descripcion ||
            "-"
        );
    }

    return (
        usuario.nombreRol ||
        usuario.rol ||
        "-"
    );
}

function obtenerNombreAlmacen(usuario) {
    if (
        usuario.almacen &&
        typeof usuario.almacen === "object"
    ) {
        return (
            usuario.almacen.nombre ||
            usuario.almacen.descripcion ||
            "-"
        );
    }

    return (
        usuario.nombreAlmacen ||
        usuario.almacen ||
        "-"
    );
}

function mostrarMensajeTabla(mensaje) {
    const tabla =
        document.getElementById(
            "tablaUsuarios"
        );

    if (!tabla) {
        return;
    }

    tabla.innerHTML = `
        <tr>
            <td
                colspan="7"
                class="text-center py-4 text-muted"
            >
                ${mensaje}
            </td>
        </tr>
    `;
}

/* =========================================================
   FILTROS
========================================================= */

function configurarFiltrosUsuarios() {
    const buscarUsuario =
        document.getElementById(
            "buscarUsuario"
        );

    const filtroEstado =
        document.getElementById(
            "filtroEstado"
        );

    const filtroRol =
        document.getElementById(
            "filtroRol"
        );

    if (buscarUsuario) {
        buscarUsuario.addEventListener(
            "input",
            function () {
                clearTimeout(
                    temporizadorBusqueda
                );

                temporizadorBusqueda =
                    setTimeout(function () {
                        paginaActual = 0;

                        listarUsuarios(
                            obtenerEstadoSeleccionado(),
                            obtenerTextoBusqueda(),
                            0,
                            tamanioPagina
                        );
                    }, 400);
            }
        );
    }

    if (filtroEstado) {
        filtroEstado.addEventListener(
            "change",
            function () {
                paginaActual = 0;

                listarUsuarios(
                    obtenerEstadoSeleccionado(),
                    obtenerTextoBusqueda(),
                    0,
                    tamanioPagina
                );
            }
        );
    }

    if (filtroRol) {
        filtroRol.addEventListener(
            "change",
            function () {
                aplicarFiltroRolLocal();
            }
        );
    }
}

function obtenerTextoBusqueda() {
    const input =
        document.getElementById(
            "buscarUsuario"
        );

    return input
        ? input.value.trim()
        : "";
}

function obtenerEstadoSeleccionado() {
    const select =
        document.getElementById(
            "filtroEstado"
        );

    if (
        !select ||
        select.value === ""
    ) {
        return null;
    }

    return select.value === "true";
}

function obtenerRolSeleccionado() {
    const select =
        document.getElementById(
            "filtroRol"
        );

    return select
        ? select.value
        : "";
}

function aplicarFiltroRolLocal() {
    const idRolSeleccionado =
        obtenerRolSeleccionado();

    if (!idRolSeleccionado) {
        mostrarUsuarios(
            usuariosCargados
        );
        return;
    }

    const filtroRol =
        document.getElementById(
            "filtroRol"
        );

    const opcionSeleccionada =
        filtroRol?.options[
        filtroRol.selectedIndex
        ];

    const textoRolSeleccionado =
        opcionSeleccionada?.textContent
            .trim()
            .toLowerCase();

    const usuariosFiltrados =
        usuariosCargados.filter(
            function (usuario) {
                const idRolUsuario =
                    usuario.idRol ||
                    usuario.rol?.idRol ||
                    usuario.rol?.id;

                if (idRolUsuario) {
                    return (
                        Number(idRolUsuario) ===
                        Number(idRolSeleccionado)
                    );
                }

                const nombreRol =
                    String(
                        usuario.nombreRol ||
                        usuario.rol?.nombre ||
                        usuario.rol?.descripcion ||
                        usuario.rol ||
                        ""
                    )
                        .trim()
                        .toLowerCase();

                return (
                    nombreRol ===
                    textoRolSeleccionado
                );
            }
        );

    mostrarUsuarios(
        usuariosFiltrados
    );
}

function limpiarFiltrosUsuarios() {
    const buscar =
        document.getElementById(
            "buscarUsuario"
        );

    const estado =
        document.getElementById(
            "filtroEstado"
        );

    const rol =
        document.getElementById(
            "filtroRol"
        );

    if (buscar) {
        buscar.value = "";
    }

    if (estado) {
        estado.value = "";
    }

    if (rol) {
        rol.value = "";
    }

    paginaActual = 0;

    listarUsuarios(
        null,
        "",
        0,
        tamanioPagina
    );
}

/* =========================================================
   TAMAÑO DE PÁGINA
========================================================= */

function configurarTamanioPagina() {
    const selectTamanio =
        document.getElementById(
            "tamanioPaginaUsuarios"
        );

    if (!selectTamanio) {
        console.error(
            "No existe el select tamanioPaginaUsuarios"
        );
        return;
    }

    tamanioPagina =
        Number(selectTamanio.value) || 10;

    selectTamanio.addEventListener(
        "change",
        async function () {
            const nuevoTamanio =
                Number(this.value);

            if (
                !Number.isInteger(nuevoTamanio) ||
                nuevoTamanio <= 0
            ) {
                return;
            }

            tamanioPagina =
                nuevoTamanio;

            paginaActual = 0;

            await listarUsuarios(
                obtenerEstadoSeleccionado(),
                obtenerTextoBusqueda(),
                0,
                tamanioPagina
            );
        }
    );
}

function sincronizarSelectorTamanio() {
    const selectTamanio =
        document.getElementById(
            "tamanioPaginaUsuarios"
        );

    if (selectTamanio) {
        selectTamanio.value =
            String(tamanioPagina);
    }
}

/* =========================================================
   INFORMACIÓN DE PAGINACIÓN
========================================================= */

function actualizarInformacionPaginacion(
    result
) {
    const total =
        result?.totalElements ?? 0;

    const pagina =
        result?.number ?? paginaActual;

    const tamanio =
        result?.size ?? tamanioPagina;

    const cantidadActual =
        result?.numberOfElements ??
        result?.content?.length ??
        usuariosCargados.length;

    const inicio =
        total === 0
            ? 0
            : pagina * tamanio + 1;

    const finCalculado =
        pagina * tamanio +
        cantidadActual;

    const fin =
        Math.min(
            finCalculado,
            total
        );

    asignarTexto(
        "registroInicio",
        inicio
    );

    asignarTexto(
        "registroFin",
        fin
    );

    asignarTexto(
        "totalRegistros",
        total
    );
}

function limpiarInformacionPaginacion() {
    asignarTexto(
        "registroInicio",
        0
    );

    asignarTexto(
        "registroFin",
        0
    );

    asignarTexto(
        "totalRegistros",
        0
    );
}

/* =========================================================
   PAGINACIÓN
========================================================= */

function mostrarPaginacionUsuarios(result) {
    const paginacion =
        document.getElementById(
            "paginacionUsuarios"
        );

    if (!paginacion) {
        return;
    }

    paginacion.innerHTML = "";

    const totalPaginas =
        result?.totalPages ?? 0;

    const primeraPagina =
        result?.first ??
        paginaActual === 0;

    const ultimaPagina =
        result?.last ??
        paginaActual >= totalPaginas - 1;

    if (totalPaginas <= 1) {
        return;
    }

    paginacion.innerHTML += `
        <li
            class="page-item ${primeraPagina
            ? "disabled"
            : ""
        }"
        >
            <button
                type="button"
                class="page-link"
                ${primeraPagina
            ? "disabled"
            : ""
        }
                onclick="cambiarPaginaUsuarios(
                    ${paginaActual - 1}
                )"
            >
                <i class="bi bi-chevron-left"></i>
                Anterior
            </button>
        </li>
    `;

    for (
        let pagina = 0;
        pagina < totalPaginas;
        pagina++
    ) {
        paginacion.innerHTML += `
            <li
                class="page-item ${pagina === paginaActual
                ? "active"
                : ""
            }"
            >
                <button
                    type="button"
                    class="page-link"
                    onclick="cambiarPaginaUsuarios(
                        ${pagina}
                    )"
                >
                    ${pagina + 1}
                </button>
            </li>
        `;
    }

    paginacion.innerHTML += `
        <li
            class="page-item ${ultimaPagina
            ? "disabled"
            : ""
        }"
        >
            <button
                type="button"
                class="page-link"
                ${ultimaPagina
            ? "disabled"
            : ""
        }
                onclick="cambiarPaginaUsuarios(
                    ${paginaActual + 1}
                )"
            >
                Siguiente
                <i class="bi bi-chevron-right"></i>
            </button>
        </li>
    `;
}

function limpiarPaginacion() {
    const paginacion =
        document.getElementById(
            "paginacionUsuarios"
        );

    if (paginacion) {
        paginacion.innerHTML = "";
    }
}

async function cambiarPaginaUsuarios(page) {
    if (page < 0) {
        return;
    }

    paginaActual = page;

    await listarUsuarios(
        obtenerEstadoSeleccionado(),
        obtenerTextoBusqueda(),
        page,
        tamanioPagina
    );
}

/* =========================================================
   RESUMEN
========================================================= */

async function obtenerResumenUsuarios() {

    try {

        const url = `${CONFIG.API_URL}/usuarios/dashboard`;

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

        // 🔥 AQUÍ YA PINTAS DIRECTO
        setDashboardUsuarios(data);

    } catch (error) {
        console.error("Error al obtener resumen:", error);
    }
}

function asignarTexto(id, valor) {
    const elemento =
        document.getElementById(id);

    if (elemento) {
        elemento.textContent =
            valor;
    }
}

/* =========================================================
   ABRIR MODAL NUEVO USUARIO
========================================================= */

function abrirModalNuevoUsuario() {
    limpiarFormularioUsuario();

    const titulo =
        document.getElementById(
            "modalUsuarioLabel"
        );

    if (titulo) {
        titulo.innerHTML = `
            <i
                class="bi bi-person-plus text-primary me-2"
            ></i>
            Registrar usuario
        `;
    }

    const boton =
        document.getElementById(
            "btnGuardarUsuario"
        );

    if (boton) {
        boton.innerHTML = `
            <i class="bi bi-floppy me-2"></i>
            Guardar usuario
        `;
    }

    const modalElemento =
        document.getElementById(
            "modalUsuario"
        );

    if (!modalElemento) {
        mostrarToast(
            "No se encontró el modal de usuario",
            "danger"
        );
        return;
    }

    const modal =
        bootstrap.Modal.getOrCreateInstance(
            modalElemento
        );

    modal.show();
}

/* =========================================================
   EDITAR USUARIO
========================================================= */

function editarUsuario(idUsuario) {
    const usuario =
        usuariosCargados.find(
            function (item) {
                return (
                    Number(item.idUsuario) ===
                    Number(idUsuario)
                );
            }
        );

    if (!usuario) {
        mostrarToast(
            "No se encontró el usuario seleccionado",
            "danger"
        );
        return;
    }

    asignarValor(
        "usuarioId",
        usuario.idUsuario
    );

    asignarValor(
        "username",
        usuario.username
    );

    asignarValor(
        "correo",
        usuario.correo
    );

    asignarValor(
        "primerNombre",
        usuario.primerNombre
    );

    asignarValor(
        "segundoNombre",
        usuario.segundoNombre
    );

    asignarValor(
        "apellidoPaterno",
        usuario.apellidoPaterno
    );

    asignarValor(
        "apellidoMaterno",
        usuario.apellidoMaterno
    );

    asignarValor(
        "password",
        ""
    );

    asignarValor(
        "confirmarPassword",
        ""
    );

    seleccionarRolUsuario(usuario);
    seleccionarAlmacenUsuario(usuario);

    const titulo =
        document.getElementById(
            "modalUsuarioLabel"
        );

    if (titulo) {
        titulo.innerHTML = `
            <i
                class="bi bi-pencil text-warning me-2"
            ></i>
            Editar usuario
        `;
    }

    const boton =
        document.getElementById(
            "btnGuardarUsuario"
        );

    if (boton) {
        boton.innerHTML = `
            <i class="bi bi-floppy me-2"></i>
            Actualizar usuario
        `;
    }

    const modalElemento =
        document.getElementById(
            "modalUsuario"
        );

    if (!modalElemento) {
        mostrarToast(
            "No se encontró el modal de usuario",
            "danger"
        );
        return;
    }

    const modal =
        bootstrap.Modal.getOrCreateInstance(
            modalElemento
        );

    modal.show();
}

function asignarValor(id, valor) {
    const elemento =
        document.getElementById(id);

    if (elemento) {
        elemento.value =
            valor ?? "";
    }
}

function seleccionarRolUsuario(usuario) {
    const select =
        document.getElementById(
            "idRol"
        );

    if (!select) {
        return;
    }

    const idRol =
        usuario.idRol ||
        usuario.rol?.idRol ||
        usuario.rol?.id;

    if (idRol) {
        select.value =
            String(idRol);
        return;
    }

    seleccionarOpcionPorTexto(
        select,
        obtenerNombreRol(usuario)
    );
}

function seleccionarAlmacenUsuario(usuario) {
    const select =
        document.getElementById(
            "idAlmacen"
        );

    if (!select) {
        return;
    }

    const idAlmacen =
        usuario.idAlmacen ||
        usuario.almacen?.idAlmacen ||
        usuario.almacen?.id;

    if (idAlmacen) {
        select.value =
            String(idAlmacen);
        return;
    }

    seleccionarOpcionPorTexto(
        select,
        obtenerNombreAlmacen(usuario)
    );
}

function seleccionarOpcionPorTexto(
    select,
    texto
) {
    if (!texto) {
        return;
    }

    const textoBuscado =
        String(texto)
            .trim()
            .toLowerCase();

    const opcion =
        Array.from(
            select.options
        ).find(
            function (item) {
                return (
                    item.textContent
                        .trim()
                        .toLowerCase() ===
                    textoBuscado
                );
            }
        );

    if (opcion) {
        select.value =
            opcion.value;
    }
}

/* =========================================================
   CREAR O ACTUALIZAR USUARIO
========================================================= */

async function guardarUsuario(event) {
    event.preventDefault();

    const idUsuario =
        Number(
            document.getElementById(
                "usuarioId"
            )?.value
        );

    const editando =
        idUsuario > 0;

    const username =
        obtenerValor(
            "username"
        );

    const password =
        obtenerValorSinTrim(
            "password"
        );

    const confirmarPassword =
        obtenerValorSinTrim(
            "confirmarPassword"
        );

    const correo =
        obtenerValor(
            "correo"
        );

    const primerNombre =
        obtenerValor(
            "primerNombre"
        );

    const segundoNombre =
        obtenerValor(
            "segundoNombre"
        );

    const apellidoPaterno =
        obtenerValor(
            "apellidoPaterno"
        );

    const apellidoMaterno =
        obtenerValor(
            "apellidoMaterno"
        );

    const idRol =
        Number(
            obtenerValor(
                "idRol"
            )
        );

    const idAlmacen =
        Number(
            obtenerValor(
                "idAlmacen"
            )
        );

    if (
        !username ||
        !correo ||
        !primerNombre ||
        !apellidoPaterno ||
        !apellidoMaterno ||
        !idRol ||
        !idAlmacen
    ) {
        mostrarToast(
            "Completa todos los campos obligatorios",
            "warning"
        );

        return;
    }

    if (
        !editando &&
        !password
    ) {
        mostrarToast(
            "Ingresa una contraseña",
            "warning"
        );

        return;
    }

    if (
        password &&
        password.length < 6
    ) {
        mostrarToast(
            "La contraseña debe tener como mínimo 6 caracteres",
            "warning"
        );

        return;
    }

    if (
        password &&
        password !== confirmarPassword
    ) {
        mostrarToast(
            "Las contraseñas no coinciden",
            "danger"
        );

        return;
    }

    const usuarioRequest = {
        username,
        correo,
        primerNombre,

        segundoNombre:
            segundoNombre || null,

        apellidoPaterno,
        apellidoMaterno,
        idRol,
        idAlmacen
    };

    /*
     * En edición solo se envía la contraseña cuando
     * el usuario escribió una nueva.
     */
    if (
        password &&
        password.trim() !== ""
    ) {
        usuarioRequest.password =
            password;
    }

    const url =
        editando
            ? `${CONFIG.API_URL}/usuarios/${idUsuario}/editar`
            : `${CONFIG.API_URL}/usuarios/crear`;

    const metodo =
        editando
            ? "PUT"
            : "POST";

    const boton =
        document.getElementById(
            "btnGuardarUsuario"
        );

    try {
        const dataSesion =
            CONFIG.getData();

        const token =
            dataSesion?.accessToken;

        if (!token) {
            mostrarToast(
                "No se encontró el token de sesión",
                "danger"
            );

            return;
        }

        if (boton) {
            boton.disabled = true;

            boton.innerHTML = `
                <span
                    class="spinner-border spinner-border-sm me-2"
                ></span>

                ${editando
                    ? "Actualizando..."
                    : "Guardando..."
                }
            `;
        }

        console.log(
            "Usuario enviado:",
            usuarioRequest
        );

        const response =
            await fetch(
                url,
                {
                    method: metodo,

                    headers: {
                        "Accept":
                            "application/json",

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${token}`
                    },

                    body:
                        JSON.stringify(
                            usuarioRequest
                        )
                }
            );

        const result =
            await obtenerRespuesta(
                response
            );

        console.log(
            "Estado HTTP:",
            response.status
        );

        console.log(
            "Respuesta del servidor:",
            result
        );

        if (!response.ok) {
            mostrarToast(
                obtenerMensajeError(
                    result,
                    editando
                        ? "No se pudo actualizar el usuario"
                        : "No se pudo crear el usuario"
                ),
                "danger"
            );

            return;
        }

        /*
         * Primero se actualiza la lista.
         */
        await listarUsuarios(
            obtenerEstadoSeleccionado(),
            obtenerTextoBusqueda(),
            paginaActual,
            tamanioPagina
        );

        /*
         * Luego se cierra y limpia el modal.
         */
        cerrarModalUsuario();
        limpiarFormularioUsuario();

        mostrarToast(
            editando
                ? "Usuario actualizado correctamente"
                : "Usuario creado correctamente",
            "success"
        );

        obtenerResumenUsuarios();

    } catch (error) {
        console.error(
            "Error al guardar usuario:",
            error
        );

        mostrarToast(
            "No se pudo conectar con el servidor",
            "danger"
        );

    } finally {
        if (boton) {
            boton.disabled = false;

            boton.innerHTML = `
                <i class="bi bi-floppy me-2"></i>

                ${editando
                    ? "Actualizar usuario"
                    : "Guardar usuario"
                }
            `;
        }
    }
}


/* =========================================================
   DESHABILITAR USUARIO
========================================================= */

async function deshabilitarUsuario(
    idUsuario,
    username
) {
    const confirmar =
        window.confirm(
            `¿Deseas deshabilitar al usuario ${username}?`
        );

    if (!confirmar) {
        return;
    }

    await cambiarEstadoUsuario(
        "PUT",
        `${CONFIG.API_URL}/usuarios/${idUsuario}/deshabilitar`,
        "Usuario deshabilitado correctamente",
        "No se pudo deshabilitar el usuario"
    );

    obtenerResumenUsuarios();
}

/* =========================================================
   HABILITAR USUARIO
========================================================= */

async function habilitarUsuario(
    idUsuario,
    username
) {
    const confirmar =
        window.confirm(
            `¿Deseas habilitar al usuario ${username}?`
        );

    if (!confirmar) {
        return;
    }

    await cambiarEstadoUsuario(
        "PUT",
        `${CONFIG.API_URL}/usuarios/${idUsuario}/habilitar`,
        "Usuario habilitado correctamente",
        "No se pudo habilitar el usuario"
    );

    obtenerResumenUsuarios();
}

/* =========================================================
   CAMBIAR ESTADO
========================================================= */

async function cambiarEstadoUsuario(
    metodo,
    url,
    mensajeExito,
    mensajeError
) {
    try {
        const dataSesion =
            CONFIG.getData();

        const token =
            dataSesion?.accessToken;

        if (!token) {
            mostrarToast(
                "No se encontró el token de sesión",
                "danger"
            );
            return;
        }

        const response = await fetch(url, {
            method: metodo,
            headers: {
                "Accept":
                    "application/json",

                "Authorization":
                    `Bearer ${token}`
            }
        });

        const result =
            await obtenerRespuesta(response);

        if (!response.ok) {
            mostrarToast(
                obtenerMensajeError(
                    result,
                    mensajeError
                ),
                "danger"
            );
            return;
        }

        mostrarToast(
            mensajeExito,
            "success"
        );

        await listarUsuarios(
            obtenerEstadoSeleccionado(),
            obtenerTextoBusqueda(),
            paginaActual,
            tamanioPagina
        );

    } catch (error) {
        console.error(
            "Error al cambiar estado:",
            error
        );

        mostrarToast(
            "No se pudo conectar con el servidor",
            "danger"
        );
    }
}

/* =========================================================
   LIMPIAR Y CERRAR MODAL
========================================================= */

function limpiarFormularioUsuario() {
    const formulario =
        document.getElementById(
            "formUsuario"
        );

    if (formulario) {
        formulario.reset();
    }

    asignarValor(
        "usuarioId",
        ""
    );

    const password =
        document.getElementById(
            "password"
        );

    const confirmarPassword =
        document.getElementById(
            "confirmarPassword"
        );

    if (password) {
        password.type =
            "password";
    }

    if (confirmarPassword) {
        confirmarPassword.type =
            "password";
    }

    const iconoPassword =
        document.getElementById(
            "iconoPassword"
        );

    const iconoConfirmar =
        document.getElementById(
            "iconoConfirmarPassword"
        );

    if (iconoPassword) {
        iconoPassword.className =
            "bi bi-eye";
    }

    if (iconoConfirmar) {
        iconoConfirmar.className =
            "bi bi-eye";
    }
}

function cerrarModalUsuario() {
    const modalElemento =
        document.getElementById(
            "modalUsuario"
        );

    if (!modalElemento) {
        return;
    }

    const modal =
        bootstrap.Modal.getInstance(
            modalElemento
        );

    if (modal) {
        modal.hide();
    }
}

/* =========================================================
   CONTRASEÑA
========================================================= */

function mostrarOcultarPassword(
    inputId,
    iconoId
) {
    const input =
        document.getElementById(
            inputId
        );

    const icono =
        document.getElementById(
            iconoId
        );

    if (!input || !icono) {
        return;
    }

    if (input.type === "password") {
        input.type = "text";

        icono.className =
            "bi bi-eye-slash";
    } else {
        input.type = "password";

        icono.className =
            "bi bi-eye";
    }
}

/* =========================================================
   FUNCIONES AUXILIARES
========================================================= */

function obtenerValor(id) {
    const elemento =
        document.getElementById(id);

    return elemento
        ? elemento.value.trim()
        : "";
}

function obtenerValorSinTrim(id) {
    const elemento =
        document.getElementById(id);

    return elemento
        ? elemento.value
        : "";
}

async function obtenerRespuesta(response) {
    const texto =
        await response.text();

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
    result,
    mensajeDefecto
) {
    if (
        result &&
        typeof result === "object"
    ) {
        return (
            result.message ||
            result.mensaje ||
            result.error ||
            mensajeDefecto
        );
    }

    if (
        typeof result === "string" &&
        result.trim() !== ""
    ) {
        return result;
    }

    return mensajeDefecto;
}

function escaparTexto(texto) {
    return String(texto)
        .replaceAll("\\", "\\\\")
        .replaceAll("'", "\\'");
}

/* =========================================================
   TOAST
========================================================= */

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
        console.log(mensaje);
        return;
    }

    textoToast.textContent =
        mensaje;

    toastElemento.classList.remove(
        "text-bg-success",
        "text-bg-danger",
        "text-bg-warning",
        "text-bg-info"
    );

    toastElemento.classList.add(
        `text-bg-${tipo}`
    );

    const toast =
        bootstrap.Toast.getOrCreateInstance(
            toastElemento,
            {
                delay: 1800,
                autohide: true
            }
        );

    toast.show();
}


