0.  <?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\TaskController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\UserController;

Route::group(['middleware' => 'auth:api'], function () {
    Route::apiResource('projects', ProjectController::class);
    Route::apiResource('tasks', TaskController::class);
    Route::apiResource('users', UserController::class);

    Route::post('/project/{project}/invite', [ProjectController::class, 'apiInvite'])->name('api.project.invite');
    Route::get('/project/{project}/users', [ProjectController::class, 'getProjectUsers'])->name('projects.users');
    Route::delete('/project/{project}/remove/{user}', [ProjectController::class, 'removeUser']);

    Route::post('/project/invite', [ProjectController::class, 'invite'])->name('project.invite');
    Route::post('/check-email', [ProjectController::class, 'checkEmail'])->name('check.email');
});

Route::group([
    'middleware' => 'api',
    'prefix' => 'auth'
], function ($router) {
    Route::post('/register', [AuthController::class, 'register'])->name('register');
    Route::post('/login', [AuthController::class, 'login'])->name('login');
    Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth:api')->name('logout');
    Route::post('/refresh', [AuthController::class, 'refresh'])->middleware('auth:api')->name('refresh');
    Route::post('/me', [AuthController::class, 'me'])->middleware('auth:api')->name('me');
});
