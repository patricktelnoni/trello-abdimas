<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use App\Models\Project;
use App\Models\Collaborator;
use Illuminate\Support\Facades\DB;

class CollaboratorController extends Controller
{
    public function show(Project $project)
    {
        return view('projects.show', compact('project'));
    }

    public function getProjectUsers($projectId)
    {
        try {
            // Cari project dengan owner
            $project = Project::with('owner')->findOrFail($projectId);

            // Hanya pemilik atau kolaborator yang boleh melihat anggota project
            $userId = auth()->user()->id;
            $isMember = $project->iduser == $userId
                || Collaborator::where('project_id', $projectId)->where('user_id', $userId)->exists();

            if (! $isMember) {
                return response()->json(['message' => 'Anda tidak memiliki akses ke project ini'], 403);
            }

            // Ambil semua collaborators termasuk data user-nya
            $collaborators = Collaborator::with('user')
                ->where('project_id', $projectId)
                ->get();
            
            return response()->json([
                'owner' => [
                    'id' => $project->owner->id,
                    'name' => $project->owner->name,
                    'email' => $project->owner->email
                ],
                'users' => $collaborators->map(function($collaborator) {
                    return [
                        'id' => $collaborator->user->id,
                        'name' => $collaborator->user->name,
                        'email' => $collaborator->user->email
                    ];
                })
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Project not found',
                'message' => $e->getMessage()
            ], 404);
        }
    }

    public function invite(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'project_id' => 'required|exists:projects,idproject',
        ]);

        // Cari user berdasarkan email
        $user = User::where('email', $request->email)->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User dengan email tersebut tidak ditemukan.'
            ], 404);
        }

        // Cek apakah user adalah owner project
        $project = Project::find($request->project_id);
        if ($project->iduser == $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'User adalah owner proyek ini.'
            ], 409);
        }

        // Cek apakah user sudah menjadi collaborator
        $exists = Collaborator::where('project_id', $request->project_id)
            ->where('user_id', $user->id)
            ->exists();

        if ($exists) {
            return response()->json([
                'success' => false,
                'message' => 'User sudah menjadi kolaborator proyek ini.'
            ], 409);
        }

        // Tambahkan sebagai collaborator
        Collaborator::create([
            'project_id' => $request->project_id,
            'user_id' => $user->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'User berhasil diundang sebagai kolaborator.'
        ]);
    }
}