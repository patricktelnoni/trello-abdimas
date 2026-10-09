const API_BASE_URL = "https://trelloapp.id/api";
 //const API_BASE_URL = "http://127.0.0.1:8000/api";

const token = localStorage.getItem("access_token");
const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
};

let projectsCache = [];

// Load projects milik owner saja
function loadOwnerProjects() {
    $.ajax({
        url: `${API_BASE_URL}/projects`,
        type: "GET",
        headers: headers,
        success: function (response) {
            // simpan ke cache, lalu render
            projectsCache = response.data || response || [];
            renderOwnerProjects(projectsCache);
        },
        error: function (xhr) {
            console.error("Gagal memuat projects:", xhr);
            $("#projects-container").html(`
                <div class="text-center py-10 text-red-500">
                    <p>Gagal memuat projects</p>
                    <button onclick="loadOwnerProjects()" class="mt-2 text-blue-600 hover:text-blue-500">
                        Coba Lagi
                    </button>
                </div>
            `);
        },
    });
}

// Debounce helper
function debounce(fn, delay = 300) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// Inisialisasi search field
function initSearch() {
    const $input = $("#project-search");
    if (!$input.length) return;

    const handleSearch = debounce(function () {
        const q = $input.val().trim().toLowerCase();
        if (!q) {
            renderOwnerProjects(projectsCache);
            return;
        }
        const filtered = projectsCache.filter((p) => {
            return (p.nama_project || "").toString().toLowerCase().includes(q);
        });
        renderOwnerProjects(filtered);
    }, 250);

    $input.off("input.search").on("input.search", handleSearch);
}

// Func Add to Task
function addTaskToProject(projectId, taskName) {
    if (!taskName || !(taskName + "").trim()) {
        if (window.toastr) toastr.warning("Nama tugas tidak boleh kosong");
        else alert("Nama tugas tidak boleh kosong");
        return;
    }

    const payload = {
        nama_task: (taskName + "").trim(),
        idproject: projectId,
    };

    $.ajax({
        url: `${API_BASE_URL}/tasks`,
        type: "POST",
        headers: headers,
        contentType: "application/json",
        data: JSON.stringify(payload),
        success: function (res) {
            if (window.toastr)
                toastr.success(res.message || "Tugas berhasil ditambahkan");
            loadProjectTasks(projectId);
        },
        error: function (xhr) {
            console.error("Gagal menambahkan task:", xhr);
            const msg =
                xhr.responseJSON && xhr.responseJSON.message
                    ? xhr.responseJSON.message
                    : "Gagal menambahkan task";
            if (window.toastr) toastr.error(msg);
            else alert(msg);
        },
    });
}

// Render projects milik owner dengan tampilan horizontal task board
function renderOwnerProjects(projects) {
    const container = $("#projects-container");
    container.empty();

    if (!projects || projects.length === 0) {
        container.html(`
            <div class="text-center py-10 text-gray-500 w-full">
                <i class="ph-bold ph-folder-simple-open text-3xl mb-3"></i>
                <p class="text-lg">Belum ada project</p>
                <p class="text-sm text-gray-400 mt-1">Klik "Tambah Project" untuk membuat project pertama Anda</p>
            </div>
        `);
        return;
    }

    // Reset container styling untuk horizontal layout
    container.css({
        display: "inline-flex",
        gap: "1.5rem",
        padding: "0 1.25rem",
        "min-width": "min-content",
        "white-space": "nowrap",
    });

    projects.forEach((project) => {
        // Buat list nama anggota
        let memberNames = "";
        let memberAvatars = "";
        if (project.users && project.users.length > 0) {
            memberNames = project.users.map((u) => u.name).join(", ");

            // Bubble Avatar Bagian Dashboard Owner
            memberAvatars = project.users
                .map(
                    (u, idx) => `
                <span class="member-avatar relative inline-flex items-center justify-center w-9 h-9 rounded-full text-sm font-normal text-white border-2 border-white ${idx > 0 ? "-ml-2" : ""} shadow cursor-pointer transition-transform hover:scale-110 hover:z-10"
                style="background: ${generateGradient()};">
                ${getInitials(u.name)}
                <span class="bubble-tooltip">
                    ${u.name}
                </span>
            </span>
        `,
                )
                .join("");
        }

        const projectCard = `
            <div class="project-card bg-white rounded-lg shadow-sm border border-gray-200 flex-shrink-0 w-[400px]">
                <!-- Project Header -->
                <div class="p-3 border-b border-gray-200 mb-3">
                    <div class="flex items-start justify-between gap-3 mb-2">
                        <!-- Left: Project Title dengan tooltip -->
                        <div class="flex-1 min-w-0 relative">
                            <div class="flex-1 min-w-0">
                                <h3 class="project-title font-bold text-xl text-gray-900 leading-tight break-words cursor-pointer">
                                    ${project.nama_project}
                                </h3>
                            </div>
                            <span class="bubble-tooltip">${project.nama_project}</span>
                        </div>

                        <!-- Right: Buttons -->
                        <div class="flex items-center gap-2 flex-shrink-0">
                            <a href="/project/${project.idproject}"
                            class="bg-blue-600 hover:bg-blue-500 text-white py-2 px-3 rounded text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap">
                                <i class="ph-bold ph-arrow-square-out"></i>
                                Buka Project
                            </a>
                            <button class="project-menu-btn p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded flex-shrink-0"
                                    data-project-id="${project.idproject}">
                                <i class="ph-bold ph-dots-three"></i>
                            </button>
                        </div>
                    </div>

                    <div class="flex items-center gap-4 text-sm text-gray-600 mb-2 mt-3">
                        <span class="flex items-center gap-1">
                            <i class="ph-bold ph-calendar"></i>
                            Dibuat: ${formatDate(project.created_at)}
                        </span>
                    </div>

                    ${memberNames
                ? `
                        <div class="flex items-center gap-2 mt-2">
                            <div class="flex items-center">
                                ${memberAvatars}
                            </div>
                        </div>
                    `
                : ""
            }
                </div>

                <!-- Vertical Task Board -->
                <div class="p-1">
                    <h4 class="text-lg font-semibold text-gray-900 mb-4">Task Board</h4>

                    <!-- Tombol buka modal Tambah Tugas -->
                    <div class="mb-3">
                        <button class="open-add-task-modal font-medium flex items-center gap-2 py-2 px-3 text-blue-500 rounded-md bg-white border border-blue-500 hover:bg-gray-100 shadow-sm"
                                data-project-id="${project.idproject}"
                                data-project-name="${project.nama_project}">
                            Tambah Tugas
                        </button>
                    </div>

                    <div id="task-board-${project.idproject}" class="task-board-container">
                        <div class="text-center text-gray-500 py-8 p-2">
                            <i class="ph-bold ph-circle-notch animate-spin text-xl mb-2"></i>
                            <p>Memuat tasks...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.append(projectCard);

        // load tasks for this project
        loadProjectTasks(project.idproject);

        const addTaskButtonHtml = `
            <div class="mb-3">
                <button class="open-add-task-modal bg-green-600 hover:bg-green-500 text-white py-2 px-3 rounded text-sm font-medium"
                        data-project-id="${project.idproject}"
                        data-project-name="${project.nama_project}">
                    Tambah Tugas
                </button>
            </div>
        `;
    });

    $(document).on("click", ".add-task-btn", function () {
        const projectId = $(this).data("project-id");
        const input = $(`#add-task-input-${projectId}`);
        const taskName = input.val();
        if (!taskName || !taskName.trim()) {
            alert("Nama tugas tidak boleh kosong");
            return;
        }

        $(this).attr("disabled", true);
        addTaskToProject(projectId, taskName);
        input.val("");
        $(this).removeAttr("disabled");
    });

    // Tambahkan event listener untuk menu project
    $(".project-menu-btn").click(function () {
        const projectId = $(this).data("project-id");
        showProjectMenu(projectId, $(this));
    });

    // Initialize scroll handlers dan show controls jika diperlukan
    const updateScrollButtons = initScrollHandlers();

    // Tampilkan scroll controls jika projects lebih dari 2
    if (projects.length > 2) {
        $("#scroll-controls").removeClass("hidden");
        // Update button states setelah render
        setTimeout(updateScrollButtons, 100);
    } else {
        $("#scroll-controls").addClass("hidden");
    }
}

// Load tasks dan render vertikal task board
function loadProjectTasks(projectId) {
    $.ajax({
        url: `${API_BASE_URL}/tasks?idproject=${projectId}`,
        type: "GET",
        headers: headers,
        success: function (tasks) {
            updateTaskStatistics(projectId, tasks);
            renderVerticalTaskBoard(projectId, tasks);
        },
        error: function (xhr) {
            console.error(`Gagal memuat tasks project ${projectId}:`, xhr);
            $(`#task-board-${projectId}`).html(`
                <div class="text-center text-red-500 py-8">
                    <i class="ph-bold ph-warning-circle text-xl mb-2"></i>
                    <p>Gagal memuat tasks</p>
                </div>
            `);
        },
    });
}

// Update statistics
function updateTaskStatistics(projectId, tasks) {
    const todoCount = tasks.filter((task) => task.status === "1").length;
    const progressCount = tasks.filter((task) => task.status === "2").length;
    const completedCount = tasks.filter((task) => task.status === "3").length;

    $(`#todo-count-${projectId}`).text(todoCount);
    $(`#progress-count-${projectId}`).text(progressCount);
    $(`#completed-count-${projectId}`).text(completedCount);
}

// Render horizontal task board (kanban style)
function renderHorizontalTaskBoard(projectId, tasks) {
    // Kelompokkan task per status
    const statusMap = {
        1: {
            label: "To Do",
            color: "bg-blue-100 text-blue-800",
            borderColor: "border-blue-200",
            icon: "ph-list-checks",
            tasks: [],
        },
        2: {
            label: "In Progress",
            color: "bg-yellow-100 text-yellow-800",
            borderColor: "border-yellow-200",
            icon: "ph-timer",
            tasks: [],
        },
        3: {
            label: "Done",
            color: "bg-green-100 text-green-800",
            borderColor: "border-green-200",
            icon: "ph-check-circle",
            tasks: [],
        },
    };

    // Kelompokkan tasks
    tasks.forEach((task) => {
        if (statusMap[task.status]) {
            statusMap[task.status].tasks.push(task);
        }
    });

    // Render horizontal task board
    let html = `
        <div class="task-board flex gap-2 overflow-x-auto pb-2">
    `;

    Object.keys(statusMap).forEach((status) => {
        const { tasks, color, borderColor, label, icon } = statusMap[status];
        const taskCount = tasks.length;

        html += `
            <div class="status-column flex-shrink-0 w-80 ${borderColor} border rounded-lg bg-gray-50">
                <div class="status-header flex items-center justify-between p-4 ${color} rounded-t-lg">
                    <div class="flex items-center gap-2">
                        <i class="ph-bold ${icon}"></i>
                        <h3 class="text-sm font-semibold">${label}</h3>
                    </div>
                </div>
                <div class="task-list p-3 space-y-3 min-h-40">
        `;

        if (tasks.length > 0) {
            tasks.forEach((task) => {
                html += `
                    <div class="task-card bg-white border border-gray-200 rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
                         onclick="window.location.href='/project/${projectId}'">
                        <h5 class="text-sm font-medium text-gray-800 mb-2 leading-tight">
                            ${task.nama_task || task.name || task.title}
                        </h5>
                        ${task.deskripsi
                        ? `
                        <p class="text-xs text-gray-500 mb-3 line-clamp-2">
                            ${task.deskripsi}
                        </p>
                        `
                        : ""
                    }
                        ${task.gdrive_link
                        ? `
                        <div class="mt-2 mb-2">
                            <a href="${task.gdrive_link}" target="_blank" rel="noopener noreferrer"
                               class="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline px-2 py-1 rounded bg-blue-50"
                               onclick="event.stopPropagation()">
                                <i class="ph-bold ph-link"></i>
                                <span>Dokumentasi</span>
                            </a>
                        </div>
                        `
                        : ""
                    }
                        <div class="flex justify-between items-center text-xs text-gray-400">
                            <div class="flex items-center gap-1 mt-2">
                                <div class="flex items-center">
                                    ${memberAvatars}
                                </div>
                            </div>
                            ${task.updated_at
                        ? `
                            <span>${formatRelativeTime(task.updated_at)}</span>
                            `
                        : ""
                    }
                        </div>
                    </div>
                `;
            });
        } else {
            html += `
                <div class="text-center py-8 text-gray-400">
                    <i class="ph-bold ph-clipboard-text text-xl mb-2"></i>
                    <p class="text-xs">Tidak ada task</p>
                </div>
            `;
        }

        html += `
                </div>
            </div>
        `;
    });

    html += `</div>`;

    $(`#task-board-${projectId}`).html(html);
}

// Render vertical task board (kanban style)
function generateGradient() {
    // Contoh: random gradient, bisa diganti sesuai kebutuhan
    const colors = [
        ["#6EE7B7", "#3B82F6"],
        ["#FDE68A", "#FCA5A5"],
        ["#A5B4FC", "#F472B6"],
        ["#F9A8D4", "#F87171"],
        ["#FCD34D", "#34D399"],
    ];
    const idx = Math.floor(Math.random() * colors.length);
    return `linear-gradient(135deg, ${colors[idx][0]}, ${colors[idx][1]})`;
}

function renderVerticalTaskBoard(projectId, tasks) {
    const statusMap = {
        1: {
            label: "To Do",
            color: "bg-blue-100 text-blue-800",
            borderColor: "border-blue-200",
            icon: "ph-list-checks",
            tasks: [],
        },
        2: {
            label: "In Progress",
            color: "bg-yellow-100 text-yellow-800",
            borderColor: "border-yellow-200",
            icon: "ph-timer",
            tasks: [],
        },
        3: {
            label: "Done",
            color: "bg-green-100 text-green-800",
            borderColor: "border-green-200",
            icon: "ph-check-circle",
            tasks: [],
        },
    };

    tasks.forEach((task) => {
        if (statusMap[task.status]) {
            statusMap[task.status].tasks.push(task);
        }
    });

    let html = `<div class="task-board flex flex-col gap-4">`;

    Object.keys(statusMap).forEach((status) => {
        const { tasks, color, borderColor, label, icon } = statusMap[status];
        const taskCount = tasks.length;

        html += `
            <div class="status-column ${borderColor} border rounded-lg bg-gray-50 mb-2">
                <div class="status-header flex items-center justify-between p-4 ${color} rounded-t-lg">
                    <div class="flex items-center gap-2">
                        <i class="ph-bold ${icon}"></i>
                        <h3 class="text-sm font-semibold">${label}</h3>
                    </div>
                    <span class="bg-white bg-opacity-50 text-xs font-medium px-2 py-1 rounded-full">
                        ${taskCount}
                    </span>
                </div>
                <div class="task-list sortable-task-list p-3 space-y-3 min-h-10" data-status="${status}" data-project-id="${projectId}">
        `;

        if (tasks.length > 0) {
            tasks.forEach((task) => {
                let userAvatar = "";
                if (task.user && task.user.name) {
                    const initials = getInitials(task.user.name);
                    userAvatar = `
                        <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2 px-2"
                             style="background: ${generateGradient()}">
                            ${initials}
                        </div>
                        <span class="text-xs text-gray-700">${task.user.name}</span>
                    `;
                } else if (task.users && task.users.length > 0) {
                    userAvatar = task.users
                        .map(
                            (u) => `
                        <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold mr-1"
                             style="background: ${generateGradient()}" title="${u.name}">
                            ${getInitials(u.name)}
                        </div>
                    `,
                        )
                        .join("");
                }

                html += `
                    <div class="task-card bg-white border border-gray-200 rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow cursor-move flex items-center"
                         data-task-id="${task.idtask}">
                        <div class="flex-1">
                            <h5 class="text-sm font-medium text-gray-800 mb-2 leading-tight">
                                ${task.nama_task || task.name || task.title || "Task #" + task.idtask}
                            </h5>
                            ${task.deskripsi
                        ? `
                            <p class="text-xs text-gray-500 mb-3 line-clamp-2">
                                ${task.deskripsi}
                            </p>
                            `
                        : ""
                    }
                            ${task.gdrive_link
                        ? `
                            <div class="mt-2 mb-2">
                                <a href="${task.gdrive_link}" target="_blank" rel="noopener noreferrer"
                                   class="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline px-2 py-1 rounded bg-blue-50"
                                   onclick="event.stopPropagation()">
                                    <i class="ph-bold ph-link"></i>
                                    <span>Dokumentasi</span>
                                </a>
                            </div>
                            `
                        : ""
                    }
                            <div class="flex items-center mt-2">
                                ${userAvatar}
                            </div>
                        </div>
                        <div class="flex flex-col items-end text-xs text-gray-400 ml-2">
                            ${task.updated_at
                        ? `
                            <span>${formatRelativeTime(task.updated_at)}</span>
                            `
                        : ""
                    }
                        </div>
                    </div>
                `;
            });
        } else {
            html += `
                <div class="text-center py-8 text-gray-400 empty-placeholder">
                    <i class="ph-bold ph-clipboard-text text-xl mb-2"></i>
                    <p class="text-xs">Tidak ada task</p>
                </div>
            `;
        }

        html += `
                </div>
            </div>
        `;
    });

    html += `</div>`;

    $(`#task-board-${projectId}`).html(html);

    // Initialize sortable untuk drag & drop
    initSortableTasks(projectId);
}

// Fungsi baru untuk Drag & Drop tasks

// Initialize drag & drop untuk tasks
function initSortableTasks(projectId) {
    $(`.sortable-task-list[data-project-id="${projectId}"]`)
        .sortable({
            connectWith: `.sortable-task-list[data-project-id="${projectId}"]`,
            placeholder: "task-placeholder",
            cursor: "move",
            tolerance: "pointer",
            helper: "clone",
            opacity: 0.6,
            receive: function (event, ui) {
                const $item = $(ui.item);
                const newStatus = $(this).data("status");
                const destProjectId = $(this).data("project-id");

                // Hapus empty placeholder jika ada
                $(this).find(".empty-placeholder").remove();

                // Cek apakah item ini adalah temporary floating task (dibuat via createFloatingTaskElement)
                const isTemp =
                    $item.attr("data-temp") === "1" ||
                    $item.data("temp") === 1 ||
                    $item.attr("data-task-name") !== undefined;

                if (isTemp) {
                    // Ambil nama task dari attribute/data atau dari teks
                    const taskName =
                        $item.attr("data-task-name") ||
                        $item.data("task-name") ||
                        $item.find("h5").first().text().trim();

                    // Siapkan payload untuk disimpan ke backend
                    const payload = {
                        nama_task: taskName,
                        idproject: destProjectId,
                        status: newStatus || 1,
                    };

                    // Inform user (opsional)
                    if (window.toastr) toastr.info("Menyimpan task...");

                    // Buat task di server
                    $.ajax({
                        url: `${API_BASE_URL}/tasks`,
                        type: "POST",
                        headers: headers,
                        contentType: "application/json",
                        data: JSON.stringify(payload),
                        success: function (res) {
                            // Ambil id dari response (sesuaikan struktur response API)
                            const created = res.task || res.data || res;
                            const realId =
                                created.idtask ||
                                created.id ||
                                (created.task &&
                                    (created.task.idtask || created.task.id));

                            // Set attribute sehingga elemen sekarang menjadi task nyata
                            if (realId) {
                                $item.attr("data-task-id", realId);
                            }
                            $item.removeAttr("data-temp");
                            $item.removeAttr("data-task-name");
                            $item.data("temp", false);

                            if (window.toastr)
                                toastr.success("Tugas berhasil dibuat");
                            // Reload tasks untuk sync (opsional, tapi memastikan konsistensi)
                            loadProjectTasks(destProjectId);
                        },
                        error: function (xhr) {
                            console.error("Gagal menyimpan task:", xhr);
                            if (window.toastr)
                                toastr.error("Gagal menyimpan task");
                            // Hapus item temp dari DOM jika gagal
                            $item.remove();
                        },
                    });
                } else {
                    // Bukan temporary -> item asli dipindah antar kolom, lakukan update status biasa
                    const taskId = $item.data("task-id");

                    // Jika taskId tidak ada, abort
                    if (!taskId) {
                        console.warn("Task moved but no taskId found:", $item);
                        return;
                    }

                    // Panggil fungsi update status (fungsi ini sudah ada di file)
                    updateTaskStatus(taskId, newStatus, destProjectId);
                }
            },
            remove: function (event, ui) {
                // Jika kolom jadi kosong, tambahkan empty placeholder
                if ($(this).children(".task-card").length === 0) {
                    $(this).html(`
                        <div class="text-center py-8 text-gray-400 empty-placeholder">
                            <i class="ph-bold ph-clipboard-text text-xl mb-2"></i>
                            <p class="text-xs">Tidak ada task</p>
                        </div>
                    `);
                }
            },
        })
        .disableSelection();
}

// Update status task via API
function updateTaskStatus(taskId, newStatus, projectId) {
    $.ajax({
        url: `${API_BASE_URL}/tasks/${taskId}`,
        type: "PUT",
        headers: headers,
        data: JSON.stringify({
            status: newStatus,
        }),
        success: function (response) {
            console.log(
                `Task ${taskId} berhasil dipindahkan ke status ${newStatus}`,
            );

            // Update counter badge
            loadProjectTasks(projectId);
        },
        error: function (xhr) {
            console.error("Gagal memindahkan task:", xhr);
            alert("Gagal memindahkan task. Silakan coba lagi.");

            // Reload tasks untuk reset posisi
            loadProjectTasks(projectId);
        },
    });
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

// Format relative time (e.g., "2 hours ago")
function formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return "baru saja";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}j`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}h`;

    return formatDate(dateString);
}

// Project menu (edit/delete)
function showProjectMenu(projectId, buttonElement) {
    // Hapus menu yang sudah ada
    $(".project-menu").remove();

    const menu = `
        <div class="project-menu absolute bg-white shadow-lg border border-gray-200 rounded-md py-1 z-10">
            <button class="edit-project w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    data-project-id="${projectId}">
                <i class="ph-bold ph-pencil-simple"></i>Edit
            </button>
            <button class="delete-project w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2"
                    data-project-id="${projectId}">
                <i class="ph-bold ph-trash"></i>Hapus
            </button>
        </div>
    `;

    $(buttonElement).after(menu);
    const menuElement = $(buttonElement).next(".project-menu");

    // Position menu
    const rect = buttonElement[0].getBoundingClientRect();
    menuElement.css({
        top: rect.bottom + 5,
        right: window.innerWidth - rect.right,
    });

    // Event listeners untuk menu
    menuElement.find(".edit-project").click(function () {
        editProject(projectId);
        menuElement.remove();
    });

    menuElement.find(".delete-project").click(function () {
        deleteProject(projectId);
        menuElement.remove();
    });

    // Close menu ketika klik di luar
    $(document).on("click.project-menu", function (e) {
        if (!$(e.target).closest(".project-menu, .project-menu-btn").length) {
            $(".project-menu").remove();
            $(document).off("click.project-menu");
        }
    });
}

function editProject(projectId) {
    const projectName = $(`.project-card [data-project-id="${projectId}"]`)
        .closest(".project-card")
        .find("h3")
        .text()
        .trim();

    const newName = prompt("Edit nama project:", projectName);
    if (newName && newName.trim() !== "" && newName !== projectName) {
        $.ajax({
            url: `${API_BASE_URL}/projects/${projectId}`,
            type: "PUT",
            headers: headers,
            data: JSON.stringify({ nama_project: newName.trim() }),
            success: function (response) {
                loadOwnerProjects(); // Reload projects
            },
            error: function (xhr) {
                alert("Gagal mengupdate project");
            },
        });
    }
}

function deleteProject(projectId) {
    if (
        confirm(
            "Apakah Anda yakin ingin menghapus project ini? Semua tugas yang terkait juga akan dihapus.",
        )
    ) {
        $.ajax({
            url: `${API_BASE_URL}/projects/${projectId}`,
            type: "DELETE",
            headers: headers,
            success: function (response) {
                loadOwnerProjects(); // Reload projects
            },
            error: function (xhr) {
                alert("Gagal menghapus project");
            },
        });
    }
}

// Modal handlers
function initModalHandlers() {
    $("#open-modal-create").click(function () {
        $("#modal-create-project").removeClass("hidden");
    });

    $("#close-modal-create, #cancel-create").click(function () {
        $("#modal-create-project").addClass("hidden");
        $("#project-name").val("");
    });

    // Create project form
    $("#create-project-form").submit(function (e) {
        e.preventDefault();

        const projectName = $("#project-name").val().trim();
        if (!projectName) {
            alert("Nama project tidak boleh kosong");
            return;
        }

        $.ajax({
            url: `${API_BASE_URL}/projects`,
            type: "POST",
            headers: headers,
            data: JSON.stringify({ nama_project: projectName }),
            success: function (response) {
                $("#modal-create-project").addClass("hidden");
                $("#project-name").val("");
                loadOwnerProjects(); // Reload projects
            },
            error: function (xhr) {
                console.error("Gagal membuat project:", xhr);
                alert("Gagal membuat project");
            },
        });
    });
}

// Modal handlers untuk "Tambah Tugas"
$(document).on("click", ".open-add-task-modal", function () {
    const projectId = $(this).data("project-id");
    const projectName =
        $(this).data("project-name") ||
        $(this).closest(".project-card").find("h3").text().trim();

    $("#modal-add-task-project-id").val(projectId);
    $("#modal-add-task-project-name").text(projectName);
    $("#modal-add-task-name").val("");
    $("#modal-add-task-desc").val("");

    $("#modal-add-task").removeClass("hidden").addClass("flex");
    $("#modal-add-task-name").focus();
});

$(document).on(
    "click",
    "#modal-add-task-close, #modal-add-task-cancel",
    function () {
        $("#modal-add-task").addClass("hidden").removeClass("flex");
    },
);

// Safe handler untuk tombol Simpan Tugas (menghindari .trim() pada undefined)
$(document).on("click", "#modal-add-task-save", function () {
    const projectId = $("#modal-add-task-project-id").val();
    const name = ($("#modal-add-task-name").val() || "").toString().trim();

    if (!name) {
        if (window.toastr) toastr.warning("Nama tugas tidak boleh kosong");
        else alert("Nama tugas tidak boleh kosong");
        $("#modal-add-task-name").focus();
        return;
    }

    addTaskToProject(projectId, name)
        .done(function (res) {
            if (window.toastr)
                toastr.success(
                    (res && res.message) || "Tugas berhasil ditambahkan",
                );
            loadProjectTasks(projectId);
            $("#modal-add-task").addClass("hidden").removeClass("flex");
        })
        .fail(function (xhr) {
            const msg =
                xhr.responseJSON && xhr.responseJSON.message
                    ? xhr.responseJSON.message
                    : "Gagal menambahkan task";
            if (window.toastr) toastr.error(msg);
            else alert(msg);
        });
});

// Initialize the dashboard
function initOwnerDashboard() {
    loadOwnerProjects();
    initModalHandlers();
    initSearch(); // <-- call search init
}

// Load dashboard ketika document ready
$(document).ready(function () {
    initOwnerDashboard();
});

function getInitials(name) {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2);
}

// Scroll handlers dengan debounce
function initScrollHandlers() {
    const wrapper = $(".projects-wrapper");
    const container = $("#projects-container");
    const scrollLeftBtn = $("#scroll-left");
    const scrollRightBtn = $("#scroll-right");
    const controls = $("#scroll-controls");

    function updateScrollButtons() {
        const scrollLeft = wrapper.scrollLeft();
        const maxScroll = Math.max(
            0,
            container.outerWidth(true) - wrapper.outerWidth(),
        );

        if (scrollLeftBtn.length)
            scrollLeftBtn.prop("disabled", scrollLeft <= 0);
        if (scrollRightBtn.length)
            scrollRightBtn.prop("disabled", scrollLeft >= maxScroll - 5); // Tolerance
    }

    if (scrollLeftBtn.length) {
        scrollLeftBtn.off("click").on("click", () => {
            wrapper.animate(
                { scrollLeft: Math.max(0, wrapper.scrollLeft() - 400) },
                300,
            );
        });
    }
    if (scrollRightBtn.length) {
        scrollRightBtn.off("click").on("click", () => {
            const maxScroll = Math.max(
                0,
                container.outerWidth(true) - wrapper.outerWidth(),
            );
            wrapper.animate(
                { scrollLeft: Math.min(maxScroll, wrapper.scrollLeft() + 400) },
                300,
            );
        });
    }

    // Update button states on scroll
    wrapper
        .off("scroll.initScroll")
        .on("scroll.initScroll", updateScrollButtons);
    // Update on resize
    $(window)
        .off("resize.initScroll")
        .on("resize.initScroll", updateScrollButtons);

    // initial update
    setTimeout(updateScrollButtons, 50);

    return updateScrollButtons;
}

// Function Floating Element

// Membuat elemen task sementara yang bisa di-drag ke sortable lists
function createFloatingTaskElement(taskName) {
    // buat element DOM (tidak disimpan ke DB dulu)
    const $el = $(`
        <div class="floating-task task-card bg-white border border-gray-200 rounded-lg shadow-sm p-4 cursor-move"
             data-temp="1" data-task-name="${$("<div>").text(taskName).html()}">
            <div class="flex-1">
                <h5 class="text-sm font-medium text-gray-800 mb-1">${taskName}</h5>
            </div>
        </div>
    `);

    // posisikan di tengah viewport atau di dekat tombol
    $el.css({
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 99999,
    });

    // tambahkan ke body
    $("body").append($el);

    // Jadikan draggable dan connect ke sortable lists
    $el.draggable({
        helper: "clone",
        connectToSortable: ".sortable-task-list",
        revert: "invalid",
        appendTo: "body",
        zIndex: 100000,
        start: function (e, ui) {
            // kalau mau styling pada helper
            ui.helper.css({ width: Math.min(320, $(window).width() * 0.9) });
        },
        stop: function (e, ui) {
            // jika tidak di-drop ke sortable, hapus elemen yang asli (floating)
            // (ui.item is set only if dropped into sortable)
            setTimeout(function () {
                if ($el && $el.parent().length) {
                    // remove floating element (original)
                    $el.remove();
                }
            }, 50);
        },
    });

    return $el;
}

// Handler tombol global: minta nama tugas lewat SweetAlert2 (atau prompt)
$(document).on("click", "#global-add-task-btn", function () {
    // prefer SweetAlert2 if available
    if (window.Swal) {
        Swal.fire({
            title: "Buat Tugas Baru (seret ke project)",
            input: "text",
            inputPlaceholder: "Nama tugas",
            showCancelButton: true,
            confirmButtonText: "Buat & Seret",
            preConfirm: (val) => {
                if (!val || !val.trim()) {
                    Swal.showValidationMessage("Nama tugas tidak boleh kosong");
                }
                return val;
            },
        }).then((result) => {
            if (result.isConfirmed) {
                const name = result.value.trim();
                const $floating = createFloatingTaskElement(name);
                // otomatis mulai drag: trigger mousedown pada elemen untuk UX (sedikit hacky)
                // pengguna boleh klik & drag manual juga
                // Fokus: beri petunjuk bahwa item bisa di-drag
                if (window.toastr)
                    toastr.info(
                        "Seret task ke project yang diinginkan untuk menyimpan",
                    );
            }
        });
    } else {
        const name = prompt("Nama tugas:");
        if (name && name.trim()) {
            createFloatingTaskElement(name.trim());
            if (window.toastr)
                toastr.info(
                    "Seret task ke project yang diinginkan untuk menyimpan",
                );
        }
    }
});
