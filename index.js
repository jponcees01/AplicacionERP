async function login(event) {
    event.preventDefault();

    const username = document
        .getElementById("usuario")
        .value
        .trim();

    const password = document
        .getElementById("password")
        .value
        .trim();

    if (!username || !password) {
        mostrarToast(
            "Ingresa usuario y contraseña",
            "warning"
        );
        return;
    }

    try {
        const response = await fetch(
            `${CONFIG.API_URL}/auth/login`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            }
        );

        const result = await response.json();

        console.log(result);

        if (!response.ok) {
            mostrarToast(
                "Usuario o contraseña incorrectos",
                "danger"
            );
            return;
        }

        localStorage.setItem(
            "data",
            JSON.stringify(result)
        );

        mostrarToast(
            "Usuario correcto",
            "success"
        );

        setTimeout(function () {
            window.location.href =
                "html/dashboard.html";
        }, 1500);

    } catch (error) {
        console.error(error);

        mostrarToast(
            "No se pudo conectar con el servidor",
            "danger"
        );
    }
}

function mostrarToast(mensaje, tipo) {
    const toastElemento =
        document.getElementById("toastLogin");

    const textoToast =
        document.getElementById("textoToast");

    textoToast.textContent = mensaje;

    toastElemento.classList.remove(
        "text-bg-success",
        "text-bg-danger",
        "text-bg-warning"
    );

    toastElemento.classList.add(
        `text-bg-${tipo}`
    );

    const toast =
        bootstrap.Toast.getOrCreateInstance(
            toastElemento,
            {
                delay: 1300,
                autohide: true
            }
        );

    toast.show();
}