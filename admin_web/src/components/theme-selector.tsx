'use client';

import { useThemeConfig } from '@/components/active-theme';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

const DEFAULT_THEMES = [
  {
    name: '默认',
    value: 'default'
  },
  {
    name: '紫色',
    value: 'purple'
  },
  {
    name: '红色',
    value: 'red'
  },
  {
    name: '粉色',
    value: 'pink'
  },
  {
    name: '青色',
    value: 'cyan'
  },
  {
    name: '蓝绿色',
    value: 'teal'
  },
  {
    name: '蓝色',
    value: 'blue'
  },
  {
    name: '绿色',
    value: 'green'
  },
  {
    name: '琥珀色',
    value: 'amber'
  }
];

const SCALED_THEMES = [
  {
    name: '默认（放大）',
    value: 'default-scaled'
  },
  {
    name: '紫色（放大）',
    value: 'purple-scaled'
  },
  {
    name: '红色（放大）',
    value: 'red-scaled'
  },
  {
    name: '粉色（放大）',
    value: 'pink-scaled'
  },
  {
    name: '青色（放大）',
    value: 'cyan-scaled'
  },
  {
    name: '蓝绿色（放大）',
    value: 'teal-scaled'
  },
  {
    name: '蓝色（放大）',
    value: 'blue-scaled'
  }
];

const MONO_THEMES = [
  {
    name: '等宽',
    value: 'mono-scaled'
  }
];

export function ThemeSelector() {
  const { activeTheme, setActiveTheme } = useThemeConfig();

  return (
    <div className='flex items-center gap-2'>
      <Label htmlFor='theme-selector' className='sr-only'>
        主题
      </Label>
      <Select value={activeTheme} onValueChange={setActiveTheme}>
        <SelectTrigger
          id='theme-selector'
          className='justify-start *:data-[slot=select-value]:w-12'
        >
          <span className='text-muted-foreground hidden sm:block'>
            选择主题色:
          </span>
          <span className='text-muted-foreground block sm:hidden'>主题</span>
          <SelectValue placeholder='请选择主题' />
        </SelectTrigger>
        <SelectContent align='end'>
          <SelectGroup>
            <SelectLabel>默认</SelectLabel>
            {DEFAULT_THEMES.map((theme) => (
              <SelectItem key={theme.name} value={theme.value}>
                {theme.name}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectSeparator />

        </SelectContent>
      </Select>
    </div>
  );
}
