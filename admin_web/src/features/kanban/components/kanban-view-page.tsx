import PageContainer from '@/components/layout/page-container';
import { KanbanBoard } from './kanban-board';

export default function KanbanViewPage() {
  return (
    <PageContainer
      pageTitle='任务看板'
      pageDescription='按执行态只读查看任务与详情'
    >
      <KanbanBoard />
    </PageContainer>
  );
}
