export default function ProfileViewPage() {
  return (
    <div className='flex w-full flex-col p-4'>
      <div className='space-y-4'>
        <h1 className='text-2xl font-semibold'>个人资料</h1>
        <p className='text-muted-foreground text-sm'>
          这里原本用于展示 Clerk 的用户资料组件。
        </p>
        <p className='text-muted-foreground text-sm'>
          当前示例已移除第三方认证，你可以在此接入自己的用户资料编辑表单。
        </p>
      </div>
    </div>
  );
}
