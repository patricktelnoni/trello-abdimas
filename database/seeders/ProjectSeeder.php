<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Faker\Factory as Faker;
use App\Models\User;

class ProjectSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        $faker = Faker::create();

        // Kolom iduser wajib diisi, jadi pastikan ada minimal satu user
        $userIds = User::pluck('id');
        if ($userIds->isEmpty()) {
            $userIds = collect([User::factory()->create()->id]);
        }

        // Menambah data ke tabel projects
        for ($i = 0; $i < 5; $i++) {
            DB::table('projects')->insert([
                'nama_project' => $faker->sentence(4),  // kalimat acak
                'iduser' => $userIds->random(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}
