// NF-001: loads realistic listing volume so search timings mean something.
//   npm run bench:seed            adds 2000 open listings (company "[benchmark]")
//   npm run bench:seed -- 5000    adds a different number
//   npm run bench:seed -- --clean removes every "[benchmark]" listing again
// Uses the DB_* settings from .env. Only touches rows whose company is "[benchmark]".
import path from 'node:path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: path.resolve('.env') });

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const MARK = '[benchmark]';

try {
  if (process.argv.includes('--clean')) {
    const [result] = await pool.execute('DELETE FROM internship_listings WHERE company_name = ?', [MARK]);
    console.log(`Removed ${result.affectedRows} benchmark listings.`);
  } else {
    const count = Number(process.argv.find((a) => /^\d+$/.test(a)) || 2000);
    const roles = ['Backend Intern', 'Frontend Intern', 'Data Analyst', 'ML Engineer', 'QA Intern', 'DevOps Intern', 'Product Intern'];
    const places = ['Bengaluru', 'Pune', 'Hyderabad', 'Chennai', 'Mumbai', 'Delhi', 'Remote'];
    const cgpas = [null, null, 6, 6.5, 7, 7.5, 8, 8.5];

    const rows = [];
    for (let i = 0; i < count; i += 1) {
      rows.push([
        `${roles[i % roles.length]} ${i + 1}`,
        MARK,
        'Benchmark listing used to measure search speed.',
        places[(i * 3) % places.length],
        i % 4 === 0 ? 'Placement' : 'Internship',
        cgpas[i % cgpas.length],
        i % 10 === 0 ? 'CLOSED' : 'OPEN',
      ]);
    }
    for (let start = 0; start < rows.length; start += 500) {
      await pool.query(
        `INSERT INTO internship_listings
           (title, company_name, description, location, listing_type, min_cgpa, status)
         VALUES ?`,
        [rows.slice(start, start + 500)]
      );
    }
    console.log(`Added ${count} benchmark listings. Remove them later with: npm run bench:seed -- --clean`);
  }
} finally {
  await pool.end();
}
