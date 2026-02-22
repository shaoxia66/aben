'use client';

import { useEffect, useMemo, useState } from 'react';
import PageContainer from '@/components/layout/page-container';
import { workspacesInfoContent } from '@/config/infoconfig';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileUploader } from '@/components/file-uploader';
import { fetchWithTenantRefresh } from '@/lib/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';

type SkillSummary = {
  skillKey: string;
  name: string;
  description: string | null;
  fileCount: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function WorkspaceSkillsPage() {
  const [uploading, setUploading] = useState(false);
  const [progresses, setProgresses] = useState<Record<string, number>>({});
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<SkillSummary | null>(null);
  const [detail, setDetail] = useState<{
    skillKey: string;
    name: string;
    description: string | null;
    files: {
      path: string;
      name: string | null;
      description: string | null;
      content: string;
      contentType: string;
      createdAt: string;
      updatedAt: string;
    }[];
  } | null>(null);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadSkills() {
    setLoadingSkills(true);
    try {
      const response = await fetchWithTenantRefresh('/api/skills', {
        method: 'GET'
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          typeof data?.error?.message === 'string'
            ? data.error.message
            : '获取 skills 列表失败';
        toast.error(message);
        return;
      }
      const list = Array.isArray(data?.skills) ? (data.skills as SkillSummary[]) : [];
      setSkills(list);
    } catch {
      toast.error('获取 skills 列表失败，请稍后重试');
    } finally {
      setLoadingSkills(false);
    }
  }

  useEffect(() => {
    void loadSkills();
  }, []);

  async function openDetail(skill: SkillSummary) {
    setSelectedSkill(skill);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    setActiveFilePath(null);

    try {
      const response = await fetchWithTenantRefresh(`/api/skills/${encodeURIComponent(skill.skillKey)}`, {
        method: 'GET'
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          typeof data?.error?.message === 'string'
            ? data.error.message
            : '获取 skill 详情失败';
        toast.error(message);
        return;
      }

      if (!data?.skill) {
        toast.error('返回数据格式不正确');
        return;
      }

      setDetail(data.skill);

      const rootFile =
        data.skill.files.find((file: { path: string }) => file.path === '') ??
        data.skill.files[0] ??
        null;
      if (rootFile) {
        setActiveFilePath(rootFile.path);
        setEditedContent(rootFile.content);
      }
    } catch {
      toast.error('获取 skill 详情失败，请稍后重试');
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleUpload(files: File[]) {
    const file = files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.skill')) {
      toast.error('仅支持上传 .skill 后缀的文件');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    setProgresses({ [file.name]: 10 });

    try {
      const response = await fetchWithTenantRefresh('/api/skills/import', {
        method: 'POST',
        body: formData
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          typeof data?.error?.message === 'string'
            ? data.error.message
            : '上传 skill 失败';
        toast.error(message);
        setProgresses({});
        return;
      }

      setProgresses({ [file.name]: 100 });

      const skillKey =
        typeof data?.skillKey === 'string' && data.skillKey
          ? data.skillKey
          : file.name.replace(/\.skill$/i, '');

      toast.success(`Skill 已导入：${skillKey}`);
      await loadSkills();
    } catch {
      toast.error('上传 skill 失败，请稍后重试');
      setProgresses({});
    } finally {
      setUploading(false);
    }
  }

  const currentFile = useMemo(() => {
    if (!detail) return null;
    if (!detail.files.length) return null;
    const byPath = activeFilePath ?? '';
    const found =
      detail.files.find((file) => file.path === byPath) ??
      detail.files.find((file) => file.path === '') ??
      detail.files[0];
    return found;
  }, [detail, activeFilePath]);

  useEffect(() => {
    if (currentFile) {
      setEditedContent(currentFile.content);
    }
  }, [currentFile]);

  const folderTree = useMemo(() => {
    if (!detail) return null;
    type FolderNode = {
      name: string;
      path: string;
      children: FolderNode[];
      files: string[];
    };

    const root: FolderNode = {
      name: '',
      path: '',
      children: [],
      files: []
    };

    for (const file of detail.files) {
      if (file.path === '') {
        root.files.push(file.path);
        continue;
      }
      const segments = file.path.split('/').filter(Boolean);
      if (!segments.length) {
        root.files.push(file.path);
        continue;
      }
      let node = root;
      for (let i = 0; i < segments.length - 1; i++) {
        const segment = segments[i]!;
        const nextPath = node.path ? `${node.path}/${segment}` : segment;
        let child = node.children.find((c) => c.path === nextPath);
        if (!child) {
          child = {
            name: segment,
            path: nextPath,
            children: [],
            files: []
          };
          node.children.push(child);
        }
        node = child;
      }
      node.files.push(file.path);
    }

    const sortNode = (node: FolderNode) => {
      node.children.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
      node.files.sort((a, b) => a.localeCompare(b, 'zh-CN'));
      node.children.forEach(sortNode);
    };

    sortNode(root);

    return root;
  }, [detail]);

  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

  function toggleFolder(path: string) {
    setOpenFolders((prev) => ({
      ...prev,
      [path]: !prev[path]
    }));
  }

  async function handleSave() {
    if (!detail || !currentFile) return;
    setSaving(true);
    try {
      const response = await fetchWithTenantRefresh(
        `/api/skills/${encodeURIComponent(detail.skillKey)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            path: currentFile.path,
            content: editedContent
          })
        }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          typeof data?.error?.message === 'string'
            ? data.error.message
            : '保存失败';
        toast.error(message);
        return;
      }
      if (data?.skill) {
        setDetail(data.skill);
      } else {
        setDetail((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            files: prev.files.map((file) =>
              file.path === currentFile.path
                ? { ...file, content: editedContent }
                : file
            )
          };
        });
      }
      toast.success('已保存');
    } catch {
      toast.error('保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer
      pageTitle='Skills 管理'
      pageDescription='查看与管理当前工作空间可用的 skills，并导入新的 skill 包'
      infoContent={workspacesInfoContent}
    >
      <div className='space-y-6'>
        <Card>
          <CardHeader>
            <div className='flex items-center justify-between gap-4'>
              <div>
                <CardTitle>Skills 列表</CardTitle>
                <CardDescription>
                  使用表格查看已存在的 skills，可以点击查看详细内容。
                </CardDescription>
              </div>
              <Button
                size='sm'
                onClick={() => {
                  setCreateOpen(true);
                }}
              >
                新增 Skill
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className='rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名称</TableHead>
                    <TableHead>标识</TableHead>
                        <TableHead>文件数</TableHead>
                        <TableHead>状态</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>更新时间</TableHead>
                    <TableHead className='text-right'>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingSkills ? (
                    <TableRow>
                      <TableCell colSpan={6} className='text-muted-foreground py-6 text-center text-sm'>
                        正在加载 skills 列表…
                      </TableCell>
                    </TableRow>
                  ) : skills.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className='text-muted-foreground py-6 text-center text-sm'>
                        尚未导入任何 skill，点击右上角“新增 Skill”进行导入。
                      </TableCell>
                    </TableRow>
                  ) : (
                    skills.map((skill) => (
                      <TableRow key={skill.skillKey}>
                        <TableCell className='font-medium'>{skill.name}</TableCell>
                        <TableCell className='text-muted-foreground text-xs'>
                          {skill.skillKey}
                        </TableCell>
                        <TableCell>{skill.fileCount}</TableCell>
                        <TableCell>
                          <div className='flex items-center gap-2'>
                            <Switch
                              checked={skill.enabled}
                              onCheckedChange={async (checked) => {
                                const nextEnabled = !!checked;
                                const prev = skills;
                                setSkills((current) =>
                                  current.map((item) =>
                                    item.skillKey === skill.skillKey
                                      ? { ...item, enabled: nextEnabled }
                                      : item
                                  )
                                );
                                try {
                                  const response = await fetchWithTenantRefresh(
                                    `/api/skills/${encodeURIComponent(skill.skillKey)}`,
                                    {
                                      method: 'PATCH',
                                      headers: {
                                        'Content-Type': 'application/json'
                                      },
                                      body: JSON.stringify({
                                        enabled: nextEnabled
                                      })
                                    }
                                  );
                                  const data = await response.json().catch(() => null);
                                  if (!response.ok) {
                                    const message =
                                      typeof data?.error?.message === 'string'
                                        ? data.error.message
                                        : '更新启用状态失败';
                                    toast.error(message);
                                    setSkills(prev);
                                    return;
                                  }
                                  toast.success(nextEnabled ? '已启用' : '已禁用');
                                } catch {
                                  toast.error('更新启用状态失败，请稍后重试');
                                  setSkills(prev);
                                }
                              }}
                            />
                            <span className='text-muted-foreground text-xs'>
                              {skill.enabled ? '启用' : '禁用'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className='text-muted-foreground text-xs'>
                          {new Date(skill.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell className='text-muted-foreground text-xs'>
                          {new Date(skill.updatedAt).toLocaleString()}
                        </TableCell>
                        <TableCell className='text-right'>
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() => openDetail(skill)}
                          >
                            查看
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side='right' className='w-full sm:max-w-[50vw]'>
          <SheetHeader>
            <SheetTitle>
              {detail?.name ?? selectedSkill?.name ?? 'Skill 详情'}
            </SheetTitle>
            <SheetDescription>
              {detail?.skillKey ?? selectedSkill?.skillKey
                ? `标识：${detail?.skillKey ?? selectedSkill?.skillKey}`
                : null}
            </SheetDescription>
          </SheetHeader>
          <div className='flex h-full flex-col gap-4 p-4 pt-0'>
            {detailLoading ? (
              <p className='text-muted-foreground text-sm'>正在加载 skill 详情…</p>
            ) : !detail ? (
              <p className='text-muted-foreground text-sm'>未能加载到 skill 详情。</p>
            ) : (
              <div className='flex h-full gap-4'>
                <div className='border-border w-64 shrink-0 rounded-md border bg-muted/30 p-2'>
                  <p className='text-foreground mb-2 text-sm font-medium'>目录结构</p>
                  <div className='space-y-1 text-xs'>
                    {folderTree && (
                      <div className='space-y-1'>
                        {detail.files.some((file) => file.path === '') && (
                          <button
                            type='button'
                            onClick={() => setActiveFilePath('')}
                            className={[
                              'flex w-full items-center rounded px-2 py-1 text-left transition',
                              activeFilePath === ''
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted'
                            ].join(' ')}
                          >
                            <span className='truncate'>SKILL.md</span>
                          </button>
                        )}
                        {folderTree.children.map((folder) => {
                          const renderFolder = (node: typeof folder, depth: number) => {
                            const isOpen = openFolders[node.path] ?? false;
                            return (
                              <div key={node.path} className='space-y-1'>
                                <button
                                  type='button'
                                  onClick={() => toggleFolder(node.path)}
                                  className='flex w-full items-center rounded px-2 py-1 text-left hover:bg-muted'
                                  style={{ paddingLeft: 8 + depth * 12 }}
                                >
                                  <span className='mr-1 text-xs'>
                                    {isOpen ? '▼' : '▶'}
                                  </span>
                                  <span className='truncate'>{node.name}</span>
                                </button>
                                {isOpen && (
                                  <div className='space-y-1'>
                                    {node.files.map((filePath) => {
                                      const active = activeFilePath === filePath;
                                      return (
                                        <button
                                          key={filePath}
                                          type='button'
                                          onClick={() => setActiveFilePath(filePath)}
                                          className={[
                                            'flex w-full items-center rounded px-2 py-1 text-left transition',
                                            active
                                              ? 'bg-primary text-primary-foreground'
                                              : 'hover:bg-muted'
                                          ].join(' ')}
                                          style={{ paddingLeft: 8 + (depth + 1) * 12 }}
                                        >
                                          <span className='truncate'>
                                            {filePath.split('/').slice(-1)[0]}
                                          </span>
                                        </button>
                                      );
                                    })}
                                    {node.children.map((child) =>
                                      renderFolder(child, depth + 1)
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          };
                          return renderFolder(folder, 0);
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className='border-border flex min-w-0 flex-1 flex-col rounded-md border bg-muted/10 p-3'>
                  <div className='mb-2'>
                    <p className='text-sm font-medium'>
                      {currentFile
                        ? currentFile.path === ''
                          ? 'SKILL.md'
                          : currentFile.path
                        : '内容'}
                    </p>
                  </div>
                  <div className='border-border flex-1 overflow-auto rounded border bg-background p-3'>
                    <textarea
                      className='h-full w-full resize-none whitespace-pre-wrap break-words font-mono text-xs leading-relaxed outline-none'
                      value={editedContent}
                      onChange={(event) => setEditedContent(event.target.value)}
                    />
                  </div>
                  <div className='mt-3 flex justify-end'>
                    <Button size='sm' onClick={handleSave} disabled={saving || !currentFile}>
                      {saving ? '保存中…' : '保存'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setProgresses({});
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增 Skill</DialogTitle>
            <DialogDescription>
              选择一个 .skill（zip 压缩）文件，导入 SKILL.md 及子目录 markdown 内容。
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <p className='text-muted-foreground text-sm'>
              仅支持单文件上传。skill 标识优先使用 zip 内顶层目录名，否则使用文件名去掉后缀。
            </p>
            <FileUploader
              onUpload={async (files) => {
                await handleUpload(files);
                setCreateOpen(false);
              }}
              progresses={progresses}
              maxFiles={1}
              multiple={false}
              disabled={uploading}
              accept={{ 'application/zip': ['.skill'] }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
