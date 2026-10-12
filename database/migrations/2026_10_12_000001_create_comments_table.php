<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('comments', function (Blueprint $table) {
            $table->id('idcomment');
            $table->unsignedBigInteger('idtask');
            $table->unsignedBigInteger('user_id');
            // null = komentar utama, berisi idcomment lain = balasan
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->text('body');
            $table->timestamps();

            $table->foreign('idtask')->references('idtask')->on('tasks')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('parent_id')->references('idcomment')->on('comments')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comments');
    }
};
