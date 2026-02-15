
import { loadEnvFromFile } from './loadenv';

type TimezoneRow = {
  TimeZone: string;
};

async function main() {
  loadEnvFromFile('.env.development');

  const { query } = await import('../src/server/shared/db/pg');
  const result = await query<TimezoneRow>('SHOW TIMEZONE');
  const timeZone = result.rows[0]?.TimeZone ?? '';
  console.log(timeZone);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
