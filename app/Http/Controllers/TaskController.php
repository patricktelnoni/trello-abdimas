<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Task;
use App\Models\Project;
use App\Models\Collaborator;

class TaskController extends Controller
{
    // user checking, user or collaborator
    private function checkProjectAccess($projectId)
    {
        $userId = auth()->user()->id;
        $project = Project::find($projectId);

        if (!$project) {
            return false;
        }

        if ($project->iduser == $userId) {
            return true;
        }

        return Collaborator::where('project_id', $projectId)
            ->where('user_id', $userId)
            ->exists();
    }

    // Aplikasi mobile mengirim "due_date"; simpan ke kolom "tenggat"
    private function mapDueDateToTenggat(Request $request)
    {
        if ($request->has("due_date") && !$request->has("tenggat")) {
            $request->merge(["tenggat" => $request->input("due_date")]);
        }
    }

    public function index(Request $request)
    {
        if ($request->boolean("unassigned")) {
            $userId = auth()->user()->id;
            $tasks = Task::whereNull("idproject")
                ->where("user_id", $userId)
                ->orderBy("order")
                ->get();

            return response()->json($tasks);
        }

        $idProject = $request->query("idproject");

        if ($idProject !== null && $idProject !== "") {
            if (!$this->checkProjectAccess($idProject)) {
                return response()->json(["message" => "Anda tidak memiliki akses ke project ini"], 403);
            }

            $tasks = Task::where("idproject", $idProject)
                ->orderBy("order")
                ->get();

            return response()->json($tasks);
        }

        $userId = auth()->user()->id;
        $accessibleProjectIds = Project::where('iduser', $userId)
            ->pluck('idproject')
            ->merge(
                Collaborator::where('user_id', $userId)->pluck('project_id')
            );

        $tasks = Task::where(function ($query) use ($accessibleProjectIds, $userId) {
                $query->whereIn('idproject', $accessibleProjectIds)
                    ->orWhere(function ($q) use ($userId) {
                        $q->whereNull('idproject')
                          ->where('user_id', $userId);
                    });
            })
            ->orderBy('order')
            ->get();

        return response()->json($tasks);
    }
    /**
     * Fetch all tasks with their related projects.
     */
    // public function index()
    // {
    //     $tasks = Task::with('project')->get();
    //     return response()->json($tasks, 200);
    // }

    /**
     * Create a new task.
     */
    public function store(Request $request)
    {
        $this->mapDueDateToTenggat($request);

        $validated = $request->validate([
            "status" => "sometimes|required|in:1,2,3",
            "nama_task" => "required|string|max:255",
            "deskripsi" => "sometimes|nullable|string",
            "tenggat" => "sometimes|nullable|date",
            "order" => "sometimes|integer",
            "gdrive_link" => "sometimes|nullable|string|url",
            "idproject" => "nullable|exists:projects,idproject",
        ]);

        if (!isset($validated["status"])) {
            $validated["status"] = 1;
        }

        if (!array_key_exists("idproject", $validated)) {
            $validated["idproject"] = null;
        }

        $validated["user_id"] = auth()->user()->id;

        if (!is_null($validated["idproject"]) && !$this->checkProjectAccess($validated["idproject"])) {
            return response()->json(["message" => "Anda tidak memiliki akses ke project ini"], 403);
        }

        if (!isset($validated["order"])) {
            $orderQuery = Task::query();

            if (is_null($validated["idproject"])) {
                $orderQuery->whereNull("idproject");
            } else {
                $orderQuery->where("idproject", $validated["idproject"]);
            }

            $maxOrder = $orderQuery->max("order");
            $validated["order"] = is_null($maxOrder) ? 1 : $maxOrder + 1;
        }

        $task = Task::create($validated);

        if ($task->project) {
            $task->project->update(["updated_at" => now()]);
        }

        return response()->json(
            [
                "message" => "Task created successfully",
                "task" => $task,
            ],
            201,
        );
    }

    /**
     * Retrieve a single task by its ID.
     */
    public function show($id)
    {
        $task = Task::with([
            "project",
            "comments" => function ($query) {
                $query->with("user:id,name")->orderBy("created_at");
            },
        ])->find($id);

        if (!$task) {
            return response()->json(["message" => "Task not found"], 404);
        }

        if ($task->idproject && !$this->checkProjectAccess($task->idproject)) {
            return response()->json(["message" => "Anda tidak memiliki akses ke task ini"], 403);
        }

        return response()->json($task, 200);
    }

    /**
     * Update a task.
     */
    public function update(Request $request, $id)
    {
        try {
            $task = Task::findOrFail($id);
            $oldProjectId = $task->idproject;

            if ($task->idproject && !$this->checkProjectAccess($task->idproject)) {
                return response()->json([
                    "success" => false,
                    "message" => "Anda tidak memiliki akses ke task ini",
                ], 403);
            }

            $this->mapDueDateToTenggat($request);

            $validated = $request->validate([
                "status" => "sometimes|required|in:1,2,3",
                "nama_task" => "sometimes|required|string|max:255",
                "deskripsi" => "sometimes|nullable|string",
                "tenggat" => "sometimes|nullable|date",
                "order" => "sometimes|integer",
                "gdrive_link" => "sometimes|nullable|string|url",
                "idproject" => "sometimes|nullable|exists:projects,idproject",
            ]);

            if (isset($validated["idproject"]) && $validated["idproject"] !== $oldProjectId) {
                if (!is_null($validated["idproject"]) && !$this->checkProjectAccess($validated["idproject"])) {
                    return response()->json([
                        "success" => false,
                        "message" => "Anda tidak memiliki akses ke project tujuan",
                    ], 403);
                }
            }

            $task->update($validated);

            if (!is_null($oldProjectId)) {
                Project::where("idproject", $oldProjectId)->update([
                    "updated_at" => now(),
                ]);
            }

            if (
                !is_null($task->idproject) &&
                (string) $task->idproject !== (string) $oldProjectId
            ) {
                Project::where("idproject", $task->idproject)->update([
                    "updated_at" => now(),
                ]);
            }

            return response()->json(
                [
                    "success" => true,
                    "message" => "Task berhasil diupdate",
                    "data" => $task,
                ],
                200,
            );
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(
                [
                    "success" => false,
                    "message" => "Task tidak ditemukan",
                ],
                404,
            );
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(
                [
                    "success" => false,
                    "message" => "Validasi gagal",
                    "errors" => $e->errors(),
                ],
                422,
            );
        } catch (\Exception $e) {
            return response()->json(
                [
                    "success" => false,
                    "message" => "Gagal update task: " . $e->getMessage(),
                ],
                500,
            );
        }
    }

    /**
     * Delete a task.
     */
    public function destroy($id)
    {
        $task = Task::find($id);

        if (!$task) {
            return response()->json(["message" => "Task not found"], 404);
        }

        if ($task->idproject && !$this->checkProjectAccess($task->idproject)) {
            return response()->json(["message" => "Anda tidak memiliki akses untuk menghapus task ini"], 403);
        }

        $project = $task->project;
        $task->delete();

        if ($project) {
            $project->update([
                "updated_at" => now(),
            ]);
        }

        return response()->json(
            ["message" => "Task deleted successfully"],
            200,
        );
    }

    public function detail(Request $request)
    {
        // Mengambil parameter 'idproject' dari query string
        $idProject = $request->query("idproject");

        // Jika parameter idproject diberikan, kita filter data berdasarkan idproject
        if ($idProject) {
            $tasks = Task::where("idproject", $idProject)->get();
        } else {
            // Jika tidak ada parameter idproject, kembalikan semua data task
            $tasks = Task::all();
        }
        
        return response()->json($tasks);
    }
}
