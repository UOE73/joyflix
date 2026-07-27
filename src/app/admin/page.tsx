'use client';

import { Settings, Users, FolderOpen, Video } from 'lucide-react';
import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';

import { AdminConfigResult } from '@/lib/admin.types';
import PageLayout from '@/components/PageLayout';

// 统一弹窗方法
const MySwal = Swal.mixin({
  customClass: {
    popup:
      'w-full max-w-md transform overflow-hidden rounded-2xl !bg-white p-6 text-left align-middle shadow-xl transition-all backdrop-blur-xl',
    title:
      'text-lg font-semibold leading-6 text-neutral-900 dark:text-neutral-100',
    htmlContainer: 'mt-2 text-sm text-neutral-600 dark:text-neutral-300',
    confirmButton:
      'inline-flex justify-center rounded-md border border-transparent bg-blue-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors',
    cancelButton:
      'inline-flex justify-center rounded-md border border-transparent bg-neutral-100 dark:bg-neutral-600 px-4 py-2.5 text-sm font-medium text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors',
    actions: 'mt-6 grid grid-cols-2 gap-3',
  },
  buttonsStyling: false,
  background: 'rgba(255, 255, 255, 0.8)',
});

const showError = (message: string) =>
  MySwal.fire({ icon: 'error', title: '错误', text: message });
const showSuccess = (message: string) =>
  MySwal.fire({
    icon: 'success',
    title: '成功',
    text: message,
    timer: 4000,
    showConfirmButton: false,
  });

const AdminDashboard = ({
  role,
  handleResetConfig,
}: {
  role: string | null;
  handleResetConfig: () => void;
}) => {
  const menuItems = [
    {
      href: '/admin/site',
      title: '站点配置',
      description: '管理全局配置',
      icon: <Settings className="w-8 h-8 text-blue-500" />,
    },
    {
      href: '/admin/user',
      title: '用户配置',
      description: '管理用户配置',
      icon: <Users className="w-8 h-8 text-purple-500" />,
    },
    {
      href: '/admin/source',
      title: '接口配置',
      description: '管理视频源、视频源测速',
      icon: <Video className="w-8 h-8 text-green-500" />,
    },
  ];

  return (
    <PageLayout>
      <div className="p-4 sm:p-6 sm:mt-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              后台设置
            </h1>
            {role === 'owner' && (
              <button
                onClick={handleResetConfig}
                className="px-2 py-1 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 border border-red-200 hover:border-red-300 dark:border-red-800 dark:hover:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
              >
                重置
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {menuItems.map((item) => (
            <Link href={item.href} key={item.title}>
              <div className="group h-full bg-white/70 dark:bg-gray-800/50 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 backdrop-blur-lg border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
                <div className="p-6 flex flex-col h-full">
                  <div className="flex-shrink-0 mb-4">{item.icon}</div>
                  <div className="flex-grow">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {item.title}
                    </h2>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {item.description}
                    </p>
                  </div>
                  <div className="mt-4 text-xs font-medium text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    进入配置 →
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </PageLayout>
  );
};

function AdminDashboardClient() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/config`);
      if (!response.ok) {
        const data = (await response.json()) as any;
        throw new Error(`获取配置失败: ${data.error}`);
      }
      const data = (await response.json()) as AdminConfigResult;
      setRole(data.Role);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '获取配置失败';
      showError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleResetConfig = async () => {
    const { isConfirmed } = await MySwal.fire({
      title: '确认恢复默认',
      text: '此操作将重置用户封禁和后台设置、自定义视频源，站点配置将重置为默认值，是否继续？',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '确认',
      cancelButtonText: '取消',
    });
    if (!isConfirmed) return;

    try {
      const response = await fetch(`/api/admin/reset`, { method: 'POST' });
      if (!response.ok) {
        throw new Error(`重置失败: ${response.status}`);
      }
      showSuccess('重置成功，请刷新页面！');
    } catch (err) {
      showError(err instanceof Error ? err.message : '重置失败');
    }
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="p-4 sm:p-6 sm:mt-8">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mb-8"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-48 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        </div>
      </PageLayout>
    );
  }

  return <AdminDashboard role={role} handleResetConfig={handleResetConfig} />;
}

export default function AdminPage() {
  return (
    <Suspense>
      <AdminDashboardClient />
    </Suspense>
  );
}
