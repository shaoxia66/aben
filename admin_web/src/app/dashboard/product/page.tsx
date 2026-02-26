import { redirect } from 'next/navigation';

export const metadata = {
  title: '控制台：Skills 仓库'
};

export default function Page() {
  redirect('/dashboard/skills-hub');
}
