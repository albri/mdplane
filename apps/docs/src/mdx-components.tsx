import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { APIPage } from '@/components/api-page';
import type { MDXComponents } from 'mdx/types';
import {
  FileText,
  FolderOpen,
  Users,
  Key,
  Workflow,
  Settings,
  BookOpen,
  Terminal,
  Globe,
  Zap,
  Search,
  Webhook,
  Radio,
  Lock,
  Download,
  Bot,
} from 'lucide-react';

const Icons = {
  FileText: () => <FileText className="size-4" />,
  FolderOpen: () => <FolderOpen className="size-4" />,
  Users: () => <Users className="size-4" />,
  Key: () => <Key className="size-4" />,
  Workflow: () => <Workflow className="size-4" />,
  Settings: () => <Settings className="size-4" />,
  BookOpen: () => <BookOpen className="size-4" />,
  Terminal: () => <Terminal className="size-4" />,
  Globe: () => <Globe className="size-4" />,
  Zap: () => <Zap className="size-4" />,
  Search: () => <Search className="size-4" />,
  Webhook: () => <Webhook className="size-4" />,
  Radio: () => <Radio className="size-4" />,
  Lock: () => <Lock className="size-4" />,
  Download: () => <Download className="size-4" />,
  Bot: () => <Bot className="size-4" />,
};

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    Tab,
    Tabs,
    APIPage,
    ...Icons,
    ...components,
  };
}
