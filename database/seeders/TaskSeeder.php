<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Faker\Factory as Faker;

class TaskSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        $faker = Faker::create();
        $projectIds = DB::table('projects')->pluck('idproject');

        // menambah data ke tabel tasks
        for ($i = 0; $i < 10; $i++) {
            DB::table('tasks')->insert([
                'nama_task' => $faker->sentence(3),
                'status' => $faker->randomElement([1, 2, 3]),  // status 1, 2, 3
                'idproject' => $projectIds->random(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}
