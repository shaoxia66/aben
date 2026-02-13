import PageContainer from '@/components/layout/page-container';
import { KanbanBoard } from './kanban-board';
import NewTaskDialog from './new-task-dialog';

export default function KanbanViewPage() {
  return (
    <PageContainer
      pageTitle='任务看板'
      pageDescription='通过拖拽管理任务'
      pageHeaderAction={<NewTaskDialog />}
    >
      <KanbanBoard />
    </PageContainer>
  );
}
