<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasColumn('tasks', 'order')) {
            return;
        }

        Schema::table('tasks', function (Blueprint $table) {
            $table->integer('order')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        // The `order` column is owned by the create_tasks_table migration,
        // so rolling this back must not drop it.
    }
};
