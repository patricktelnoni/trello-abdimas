<?php

use Illuminate\Support\Facades\Route;
use App\Http\Middleware\CheckJwtToken;
use App\Http\Middleware\CheckProjectAccess;
use Illuminate\Support\Facades\Log;
use App\Http\Controllers\CollaboratorController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\TaskController;

Route::get("/login", function () {
    return view("auth.login");
});

Route::get("/register", function () {
    return view("auth.register");
});

# Dashboard Lama
// Route::fallback(function () {
//     return redirect("/project");
// });

# Dashboard Baru
Route::fallback(function () {
    return redirect("/my-projects");
});

// Route yang butuh JWT
Route::middleware([CheckJwtToken::class])->group(function () {
    Route::get("/project", function () {
        return view("project.index");
    });

    Route::middleware([CheckProjectAccess::class])->group(function () {
        Route::get("/project/{id}", function ($id) {
            return view("project.detail", ["id" => $id]);
        });
    });
    // Route::get('/project/{id}', function ($id) {
    //     return view('project.detail', ['id' => $id]);
    // });

    Route::get("/my-projects", function () {
        return view("owner.dashboard");
    });

    // Optional: redirect root ke my-projects
    Route::get("/projects", function () {
        return redirect("/my-projects");
    });

    Route::post("/project/invite", [
        CollaboratorController::class,
        "invite",
    ])->name("collaborators.invite");
    // Route::get('/project/{id}', [ProjectController::class, 'showDetail'])->name('projects.showDetail');
    // Route::post('/project/invite', [ProjectController::class, 'invite'])->name('project.invite');
    // Route::post('/check-email', [ProjectController::class, 'checkEmail'])->name('check.email');
    // Route::post('/api/check-email', [CollaboratorController::class, 'checkEmail']);
    // Jangan definisikan route /api/* di sini: route web didaftarkan sebelum
    // routes/api.php sehingga akan menimpa endpoint API (mis. GET /api/projects).
});
