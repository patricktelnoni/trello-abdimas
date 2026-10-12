<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Comment extends Model
{
    use HasFactory;

    protected $table = 'comments';
    protected $primaryKey = 'idcomment';
    protected $fillable = ['idtask', 'user_id', 'parent_id', 'body'];

    /**
     * Relasi dengan model Task
     * Setiap komentar dimiliki oleh satu task.
     */
    public function task()
    {
        return $this->belongsTo(Task::class, 'idtask', 'idtask');
    }

    /**
     * Relasi dengan model User
     * Setiap komentar ditulis oleh satu user.
     */
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }

    /**
     * Komentar yang dibalas (null jika komentar utama).
     */
    public function parent()
    {
        return $this->belongsTo(Comment::class, 'parent_id', 'idcomment');
    }

    /**
     * Balasan-balasan untuk komentar ini.
     */
    public function replies()
    {
        return $this->hasMany(Comment::class, 'parent_id', 'idcomment');
    }
}
