const API_BASE_URL = "https://trelloapp.id/api";
// const API_BASE_URL = "http://127.0.0.1:8000/api";

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
            // simpan ke cache, lalu render berdasarkan search + filter semester aktif
            projectsCache = response.data || response || [];
            applyProjectFilters();
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

function parseProjectCreatedAt(createdAt) {
    if (!createdAt) return null;

    let parsed = new Date(createdAt);
    if (Number.isNaN(parsed.getTime())) {
        parsed = new Date(String(createdAt).replace(" ", "T"));
    }

    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseInputDate(value) {
    if (!value) return null;
    const raw = String(value).trim();

    if (raw.includes("/")) {
        const parts = raw.split("/");
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            let year = parseInt(parts[2], 10);
            if (year < 100) year += 2000;
            const parsed = new Date(year, month, day);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }
    }

    if (raw.includes("-")) {
        const parsed = new Date(raw + "T00:00:00");
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const fallback = new Date(raw);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function toInputDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatFilterDate(date) {
    return date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function generateSemesterOptions() {
    // Academic semester system:
    // Semester Ganjil: August - January  => labeled as YYYY/YYYY+1 - Ganjil
    // Semester Genap:  February - July   => labeled as YYYY/YYYY+1 - Genap
    const now = new Date();
    const currentYear = now.getFullYear();

    const semesters = [];

    // Generate semesters: 3 years back + current + 1 year ahead
    for (let startYear = currentYear - 3; startYear <= currentYear + 1; startYear++) {
        const endYear = startYear + 1;

        // Semester Ganjil: Aug startYear – Jan endYear
        semesters.push({
            label: `${startYear}/${endYear} - Ganjil`,
            start: new Date(startYear, 7, 1),  // Aug 1
            end: new Date(endYear, 0, 31, 23, 59, 59),  // Jan 31
        });

        // Semester Genap: Feb endYear – Jul endYear
        semesters.push({
            label: `${startYear}/${endYear} - Genap`,
            start: new Date(endYear, 1, 1),  // Feb 1
            end: new Date(endYear, 6, 31, 23, 59, 59),  // Jul 31
        });
    }

    // Determine which semester is active now
    let activeSemester = null;
    for (const sem of semesters) {
        if (now >= sem.start && now <= sem.end) {
            activeSemester = sem.label;
            break;
        }
    }

    return { semesters, activeSemester };
}

function applyProjectFilters() {
    let filtered = Array.isArray(projectsCache) ? [...projectsCache] : [];

    const searchQuery = String($("#project-search").val() || "")
        .trim()
        .toLowerCase();

    const rangeStartRaw = String(
        $("#project-filter-start-date").val() || "",
    ).trim();
    const rangeEndRaw = String(
        $("#project-filter-end-date-iso").val() || "",
    ).trim();

    if (searchQuery) {
        filtered = filtered.filter((project) =>
            (project.nama_project || "")
                .toString()
                .toLowerCase()
                .includes(searchQuery),
        );
    }

    if (rangeStartRaw && rangeEndRaw) {
        const rangeStart = new Date(rangeStartRaw + "T00:00:00");
        const rangeEnd = new Date(rangeEndRaw + "T23:59:59");

        if (
            !Number.isNaN(rangeStart.getTime()) &&
            !Number.isNaN(rangeEnd.getTime())
        ) {
            filtered = filtered.filter((project) => {
                const projectDate = parseProjectCreatedAt(project.created_at);
                return (
                    projectDate &&
                    projectDate >= rangeStart &&
                    projectDate <= rangeEnd
                );
            });
        }
    }

    renderOwnerProjects(filtered);
}

function initSearch() {
    const $input = $("#project-search");
    const debouncedApply = debounce(applyProjectFilters, 250);

    if ($input.length) {
        $input.off("input.search").on("input.search", debouncedApply);
    }
}

function initProjectFilterUI() {
    const $dropdown = $("#project-filter-dropdown");
    if (!$dropdown.length) return;

    const $btn = $("#project-filter-btn");
    const $panel = $("#project-filter-panel");
    const $list = $("#semester-filter-list");
    const $btnText = $("#project-filter-btn-text");
    const $startHidden = $("#project-filter-start-date");
    const $endIso = $("#project-filter-end-date-iso");

    const { semesters, activeSemester } = generateSemesterOptions();

    // Build the semester list HTML
    let listHtml = '';

    // "Semua Project" option at top
    listHtml += `<button class="semester-filter-item" data-semester="all">
        <i class="ph-bold ph-list-bullets"></i>
        <span>Semua Semester</span>
    </button>`;

    // Add semester items (newest first)
    const reversed = [...semesters].reverse();
    for (const sem of reversed) {
        const isCurrent = sem.label === activeSemester;
        const startISO = toInputDate(sem.start);
        const endISO = toInputDate(sem.end);

        listHtml += `<button class="semester-filter-item${isCurrent ? ' current' : ''}"
            data-semester="${sem.label}"
            data-start="${startISO}"
            data-end="${endISO}">
            <i class="ph-bold ph-graduation-cap"></i>
            <span>${sem.label}</span>
        </button>`;
    }

    $list.html(listHtml);

    // Helper to select a semester by its data-semester value
    function selectSemester(semesterValue) {
        $list.find(".semester-filter-item").removeClass("active");

        const $target = $list.find(`.semester-filter-item[data-semester="${semesterValue}"]`);
        if (!$target.length) {
            // Fallback to "all" if saved value no longer exists
            $list.find('.semester-filter-item[data-semester="all"]').addClass("active");
            $startHidden.val("");
            $endIso.val("");
            $btnText.text("Semua Semester");
            $btn.removeClass("project-filter-active");
            localStorage.removeItem("semesterFilter");
            return;
        }

        $target.addClass("active");

        if (semesterValue === "all") {
            $startHidden.val("");
            $endIso.val("");
            $btnText.text("Semua Semester");
            $btn.removeClass("project-filter-active");
        } else {
            $startHidden.val($target.data("start"));
            $endIso.val($target.data("end"));
            $btnText.text(semesterValue);
            $btn.addClass("project-filter-active");
        }
    }

    // Toggle panel
    $btn.off("click.projectFilter").on("click.projectFilter", function (e) {
        e.preventDefault();
        e.stopPropagation();
        $panel.toggleClass("hidden");
    });

    // Handle semester item click
    $list.off("click.semesterItem").on("click.semesterItem", ".semester-filter-item", function (e) {
        e.preventDefault();

        const semester = $(this).data("semester");
        selectSemester(semester);

        // Save to localStorage
        if (semester === "all") {
            localStorage.removeItem("semesterFilter");
        } else {
            localStorage.setItem("semesterFilter", semester);
        }

        // Close panel and apply filter
        $panel.addClass("hidden");
        applyProjectFilters();
    });

    // Close on outside click
    $(document)
        .off("click.projectFilterOutside")
        .on("click.projectFilterOutside", function (e) {
            if (!$(e.target).closest("#project-filter-dropdown").length) {
                $panel.addClass("hidden");
            }
        });

    // Restore saved filter from localStorage
    const savedFilter = localStorage.getItem("semesterFilter");
    if (savedFilter) {
        selectSemester(savedFilter);
    } else {
        selectSemester("all");
    }
}


function escapeHtml(text) {
    const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
    };
    return String(text || "").replace(/[&<>"']/g, function (m) {
        return map[m];
    });
}

// function populateTaskProjectOptions(selectedProjectId = "") {
//     const $select = $("#modal-add-task-project-id");
//     if (!$select.length) return;

//     const selectedId = String(selectedProjectId || "");
//     const options = ['<option value="">Pilih project</option>'];

//     (projectsCache || []).forEach(function (project) {
//         const id = String(project.idproject || "");
//         const name = escapeHtml(project.nama_project || "Project #" + id);
//         const selectedAttr = id === selectedId ? " selected" : "";
//         options.push(
//             '<option value="' +
//                 id +
//                 '"' +
//                 selectedAttr +
//                 ">" +
//                 name +
//                 "</option>",
//         );
//     });

//     $select.html(options.join(""));
// }

function normalizeNullableProjectId(value) {
    if (value === undefined || value === null) return null;
    var normalized = String(value).trim();
    return normalized === "" ? null : normalized;
}

function addTaskToProject(projectId, taskName) {
    var normalizedTaskName = String(taskName || "").trim();

    if (!normalizedTaskName) {
        return $.Deferred()
            .reject({
                responseJSON: { message: "Nama tugas tidak boleh kosong" },
            })
            .promise();
    }

    var payload = {
        nama_task: normalizedTaskName,
        status: "1",
        idproject: normalizeNullableProjectId(projectId),
    };

    return $.ajax({
        url: API_BASE_URL + "/tasks",
        type: "POST",
        headers: headers,
        contentType: "application/json",
        data: JSON.stringify(payload),
    });
}

function loadUnassignedTasks() {
    $.ajax({
        url: API_BASE_URL + "/tasks?unassigned=1",
        type: "GET",
        headers: headers,
        success: function (tasks) {
            renderUnassignedTasks(tasks || []);
            initSortableTasks();
        },
        error: function (xhr) {
            console.error("Gagal memuat task pool:", xhr);
            $("#unassigned-task-list").html(
                '<div class="text-center py-6 text-red-500">' +
                '<i class="ph-bold ph-warning-circle text-xl mb-2"></i>' +
                "<p>Gagal memuat task pool</p>" +
                "</div>",
            );
        },
    });
}

function renderUnassignedTasks(tasks) {
    var $list = $("#unassigned-task-list");
    if (!$list.length) return;

    if (!tasks.length) {
        $list.html(
            '<div class="w-full text-center py-8 text-gray-400 empty-placeholder">' +
            '<i class="ph-bold ph-clipboard-text text-xl mb-2"></i>' +
            '<p class="text-xs">Belum ada task</p>' +
            "</div>",
        );
        return;
    }

    var html = "";

    tasks.forEach(function (task) {
        var rawTaskName =
            task.nama_task || task.name || task.title || "Task #" + task.idtask;
        var taskName = escapeHtml(rawTaskName);

        html +=
            '<div class="task-card bg-white border border-gray-200 rounded-lg shadow-sm p-3 hover:shadow-md transition-shadow cursor-move flex items-start flex-shrink-0" style="width: 260px; min-width: 260px;" data-task-id="' +
            task.idtask +
            '">';

        html += '<div class="flex-1 min-w-0">';
        html +=
            '<h5 class="text-sm font-medium text-gray-800 mb-1 truncate" title="' +
            taskName +
            '">' +
            taskName +
            "</h5>";

        if (task.gdrive_link) {
            html += '<div class="mt-1">';
            html +=
                '<a href="' +
                task.gdrive_link +
                '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline px-2 py-1 rounded bg-blue-50" onclick="event.stopPropagation()">';
            html +=
                '<i class="ph-bold ph-link"></i><span>Dokumentasi</span></a></div>';
        }

        html += "</div>";

        html += '<div class="text-xs text-gray-400 ml-2 flex-shrink-0">';
        html += task.updated_at
            ? "<span>" + formatRelativeTime(task.updated_at) + "</span>"
            : "";
        html += "</div>";

        html += "</div>";
    });

    $list.html(html);
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
        padding: "0",
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
function initSortableTasks() {
    var $lists = $(".sortable-task-list");

    $lists.each(function () {
        if ($(this).hasClass("ui-sortable")) {
            $(this).sortable("destroy");
        }
    });

    $lists
        .sortable({
            connectWith: ".sortable-task-list",
            placeholder: "task-placeholder",
            cursor: "move",
            tolerance: "pointer",
            helper: "clone",
            opacity: 0.6,
            receive: function (event, ui) {
                var taskId = ui.item.data("task-id");
                var newStatus = String($(this).data("status") || "1");

                var targetProjectId = normalizeNullableProjectId(
                    $(this).data("project-id"),
                );
                var sourceProjectId = normalizeNullableProjectId(
                    ui.sender ? ui.sender.data("project-id") : null,
                );

                $(this).find(".empty-placeholder").remove();
                updateTaskStatus(
                    taskId,
                    newStatus,
                    targetProjectId,
                    sourceProjectId,
                );
            },
            remove: function () {
                if ($(this).children(".task-card").length === 0) {
                    $(this).html(
                        '<div class="text-center py-8 text-gray-400 empty-placeholder">' +
                        '<i class="ph-bold ph-clipboard-text text-xl mb-2"></i>' +
                        '<p class="text-xs">Tidak ada task</p>' +
                        "</div>",
                    );
                }
            },
        })
        .disableSelection();
}

function updateTaskStatus(taskId, newStatus, targetProjectId, sourceProjectId) {
    $.ajax({
        url: API_BASE_URL + "/tasks/" + taskId,
        type: "PUT",
        headers: headers,
        contentType: "application/json",
        data: JSON.stringify({
            status: String(newStatus),
            idproject: targetProjectId,
        }),
        success: function () {
            loadUnassignedTasks();

            if (targetProjectId !== null) {
                loadProjectTasks(targetProjectId);
            }

            if (
                sourceProjectId !== null &&
                String(sourceProjectId) !== String(targetProjectId)
            ) {
                loadProjectTasks(sourceProjectId);
            }
        },
        error: function (xhr) {
            console.error("Gagal memindahkan task:", xhr);
            alert("Gagal memindahkan task. Silakan coba lagi.");

            loadUnassignedTasks();
            loadOwnerProjects();
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

    $("#global-add-task-btn")
        .off("click.globalAddTask")
        .on("click.globalAddTask", function () {
            $("#modal-add-task-name").val("");
            $("#modal-add-task").removeClass("hidden").addClass("flex");
            $("#modal-add-task-name").focus();
        });

    $(document)
        .off("click.modalAddTaskClose")
        .on(
            "click.modalAddTaskClose",
            "#modal-add-task-close, #modal-add-task-cancel",
            function () {
                $("#modal-add-task").addClass("hidden").removeClass("flex");
            },
        );

    $(document)
        .off("click.modalAddTaskSave")
        .on("click.modalAddTaskSave", "#modal-add-task-save", function () {
            var name = String($("#modal-add-task-name").val() || "").trim();

            if (!name) {
                if (window.toastr)
                    toastr.warning("Nama tugas tidak boleh kosong");
                else alert("Nama tugas tidak boleh kosong");
                $("#modal-add-task-name").focus();
                return;
            }

            var $saveBtn = $(this);
            $saveBtn.prop("disabled", true);

            addTaskToProject(null, name)
                .done(function (res) {
                    $("#modal-add-task").addClass("hidden").removeClass("flex");
                    $("#modal-add-task-name").val("");
                    loadUnassignedTasks();
                })
                .fail(function (xhr) {
                    var msg =
                        (xhr.responseJSON && xhr.responseJSON.message) ||
                        "Gagal menambahkan task";
                    if (window.toastr) toastr.error(msg);
                    else alert(msg);
                })
                .always(function () {
                    $saveBtn.prop("disabled", false);
                });
        });

    $("#create-project-form").submit(function (e) {
        e.preventDefault();

        const projectName = $("#project-name").val().trim();
        if (!projectName) {
            alert("Nama project tidak boleh kosong");
            return;
        }

        $.ajax({
            url: API_BASE_URL + "/projects",
            type: "POST",
            headers: headers,
            data: JSON.stringify({ nama_project: projectName }),
            success: function () {
                $("#modal-create-project").addClass("hidden");
                $("#project-name").val("");
                loadOwnerProjects();
            },
            error: function (xhr) {
                console.error("Gagal membuat project:", xhr);
                alert("Gagal membuat project");
            },
        });
    });
}

// Initialize the dashboard
function initOwnerDashboard() {
    loadOwnerProjects();
    loadUnassignedTasks();
    initModalHandlers();
    initProjectFilterUI();
    initSearch();
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
