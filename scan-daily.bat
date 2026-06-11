@echo off
REM ============================================================
REM  Daily Chess.com scan trigger
REM  - Opens the analyzer in your default browser with ?scan=1
REM    which forces it to fetch new games on load.
REM  - Schedule via Windows Task Scheduler to run once a day.
REM ============================================================

REM Make sure XAMPP Apache is running before scheduling this.
start "" "http://localhost/ONE/chess-analyzer/?scan=1"
