<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Task extends Model
{
    use HasFactory;

    protected $table = 'tasks'; // Nama tabel
    protected $primaryKey = 'idtask'; // Primary key
    protected $fillable = ['nama_task', 'deskripsi', 'tenggat', 'status', 'order', 'idproject', 'gdrive_link', 'user_id']; // Kolom yang bisa diisi secara massal

    protected $casts = [
        'tenggat' => 'datetime',
    ];

    // Aplikasi mobile membaca tenggat sebagai "due_date"
    protected $appends = ['due_date'];

    public function getDueDateAttribute()
    {
        return $this->tenggat?->toJSON();
    }

    /**
     * Relasi dengan model Project
     * Setiap task dimiliki oleh satu project.
     */
    public function project()
    {
        return $this->belongsTo(Project::class, 'idproject', 'idproject');
    }

    /**
     * Relasi dengan model User
     * Setiap task dibuat oleh satu user.
     */
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }

    /**
     * Relasi dengan model Comment
     * Satu task bisa memiliki banyak komentar (termasuk balasan).
     */
    public function comments()
    {
        return $this->hasMany(Comment::class, 'idtask', 'idtask');
    }
}
