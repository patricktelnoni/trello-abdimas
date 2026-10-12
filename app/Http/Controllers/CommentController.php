<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Task;
use App\Models\Comment;
use App\Models\Project;
use App\Models\Collaborator;

class CommentController extends Controller
{
    // Komentar boleh dibaca/ditulis oleh siapa pun yang punya akses ke task-nya
    private function canAccessTask(Task $task)
    {
        $userId = auth()->user()->id;

        // Task tanpa project hanya milik pembuatnya
        if (is_null($task->idproject)) {
            return $task->user_id == $userId;
        }

        $project = Project::find($task->idproject);

        if (!$project) {
            return false;
        }

        if ($project->iduser == $userId) {
            return true;
        }

        return Collaborator::where('project_id', $task->idproject)
            ->where('user_id', $userId)
            ->exists();
    }

    /**
     * Ambil semua komentar milik task (urut dari yang terlama).
     * Balasan dikenali dari parent_id yang berisi idcomment komentar induk.
     */
    public function index($taskId)
    {
        $task = Task::find($taskId);

        if (!$task) {
            return response()->json(["message" => "Task not found"], 404);
        }

        if (!$this->canAccessTask($task)) {
            return response()->json(["message" => "Anda tidak memiliki akses ke task ini"], 403);
        }

        $comments = $task->comments()
            ->with('user:id,name')
            ->orderBy('created_at')
            ->get(['idcomment', 'idtask', 'parent_id', 'user_id', 'body', 'created_at', 'updated_at']);

        return response()->json($comments, 200);
    }

    /**
     * Tambah komentar baru, atau balasan jika parent_id diisi.
     */
    public function store(Request $request, $taskId)
    {
        $task = Task::find($taskId);

        if (!$task) {
            return response()->json(["message" => "Task not found"], 404);
        }

        if (!$this->canAccessTask($task)) {
            return response()->json(["message" => "Anda tidak memiliki akses ke task ini"], 403);
        }

        $validated = $request->validate([
            "body" => "required|string",
            "parent_id" => "sometimes|nullable|integer",
        ]);

        // Balasan harus merujuk ke komentar pada task yang sama
        if (!empty($validated["parent_id"])) {
            $parentExists = Comment::where('idcomment', $validated["parent_id"])
                ->where('idtask', $task->idtask)
                ->exists();

            if (!$parentExists) {
                return response()->json([
                    "message" => "Komentar yang dibalas tidak ditemukan pada task ini",
                ], 422);
            }
        }

        $comment = Comment::create([
            "idtask" => $task->idtask,
            "user_id" => auth()->user()->id,
            "parent_id" => $validated["parent_id"] ?? null,
            "body" => $validated["body"],
        ]);

        $comment->load('user:id,name');

        return response()->json(
            [
                "message" => "Komentar berhasil ditambahkan",
                "comment" => $comment,
            ],
            201,
        );
    }

    /**
     * Ubah isi komentar (hanya oleh penulisnya).
     */
    public function update(Request $request, $commentId)
    {
        $comment = Comment::find($commentId);

        if (!$comment) {
            return response()->json(["message" => "Komentar tidak ditemukan"], 404);
        }

        if ($comment->user_id != auth()->user()->id) {
            return response()->json(["message" => "Hanya penulis yang dapat mengubah komentar"], 403);
        }

        $validated = $request->validate([
            "body" => "required|string",
        ]);

        $comment->update($validated);
        $comment->load('user:id,name');

        return response()->json(
            [
                "message" => "Komentar berhasil diubah",
                "comment" => $comment,
            ],
            200,
        );
    }

    /**
     * Hapus komentar beserta seluruh balasannya (hanya oleh penulisnya).
     */
    public function destroy($commentId)
    {
        $comment = Comment::find($commentId);

        if (!$comment) {
            return response()->json(["message" => "Komentar tidak ditemukan"], 404);
        }

        if ($comment->user_id != auth()->user()->id) {
            return response()->json(["message" => "Hanya penulis yang dapat menghapus komentar"], 403);
        }

        $comment->delete();

        return response()->json(["message" => "Komentar berhasil dihapus"], 200);
    }
}
