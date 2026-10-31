# Page load and search response time (OIPP-NF-001)

Requirement: page loading and search respond within 3 seconds at the 90th percentile
(p90) under normal mini-project load. Pass mark used here: p90 <= 3000 ms with no errors.

## How to measure

1. `npm run build`, make sure MySQL is running and the migrations in `database/` are applied.
2. Load realistic data: `npm run bench:seed` (adds 2000 open listings marked `[benchmark]`;
   pass a number to change it, for example `npm run bench:seed -- 5000`).
3. Start the app: `npm start`.
4. In a second terminal: `npm run benchmark`.
   - It measures a full page load (the HTML plus every asset it references), the readiness
     check, all active listings, each search filter, and the student's applications.
   - Defaults: 200 requests per endpoint, 10 users at a time. Change them with
     `BENCH_REQUESTS` and `BENCH_CONCURRENCY`.
   - To include recruiter routes, set `BENCH_RECRUITER_TOKEN` (an approved recruiter's login
     token) and `BENCH_LISTING_ID` (one of that recruiter's listings).
5. The result table is printed and saved to `logs/benchmark-<time>.md` (not committed).
   The command exits with an error if any endpoint is over the limit.
6. Remove the test data afterwards: `npm run bench:seed -- --clean`.

## Results

Copy the table from `logs/benchmark-<time>.md` after each run.
| 31-10-2026 | Windows laptop, 16 GB RAM, MySQL 8 | 2000 | 10 | 111 ms | PASS |

## Issues identified during testing

Found while testing with 5,000 seeded listings on MariaDB 10.11, 10 simultaneous users.
Every endpoint was well inside the 3-second limit, and the slowest p90 was a little over
0.4 seconds. These are the weak spots:

1. **Search returns every active listing in one response.** With about 4,500 open listings the
   unfiltered search returns about 1 MB of JSON (about 50 KB compressed), and its time grows
   with the number of listings. Filtered searches were much smaller (about 480 rows) and
   faster. Recommendation: add paging (a page size and an offset) before listings reach the
   tens of thousands. Not changed here because it alters the response the web app already
   reads.
2. **The search query scans the table and sorts the result.** `EXPLAIN` shows a full scan
   with a filesort. A composite index on `(status, created_at)` was tried; the database kept
   the same plan (about 90% of the test listings are open, so scanning is cheaper than using
   the index) and the timings did not change beyond noise, so no index was added. Revisit
   this if closed or draft listings become the majority.
3. **Role and location filters use `LIKE '%text%'`**, which cannot use an ordinary index. This
   is fine at this size. A full-text index would be the next step if search becomes slow.
4. **Web app files are served uncompressed.** The server sends the JavaScript and CSS without
   compression, which matters on slow connections. Recommendation: turn on compression in the
   hosting layer or add the `compression` middleware.
5. **Not measured:** login (bcrypt is deliberately slow, and logins are rate limited) and OTP
   email delivery (depends on the SMTP provider).

Update this list whenever a benchmark run shows a new problem or a fix is made.
