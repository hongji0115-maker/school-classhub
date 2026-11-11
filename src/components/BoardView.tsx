'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Copy,
  Check,
  Heart,
  Plus,
  Trash2,
  Maximize2,
  Minimize2,
  Columns,
  LayoutGrid,
  Sparkles,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Room, BoardPost } from '@/lib/types';

const COLOR_CLASSES: Record<BoardPost['color'], { bg: string; border: string; tag: string }> = {
  yellow: { bg: 'bg-amber-50', border: 'border-amber-200', tag: 'bg-amber-100 text-amber-800' },
  green: { bg: 'bg-emerald-50', border: 'border-emerald-200', tag: 'bg-emerald-100 text-emerald-800' },
  blue: { bg: 'bg-sky-50', border: 'border-sky-200', tag: 'bg-sky-100 text-sky-800' },
  pink: { bg: 'bg-rose-50', border: 'border-rose-200', tag: 'bg-rose-100 text-rose-800' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', tag: 'bg-purple-100 text-purple-800' },
  white: { bg: 'bg-white', border: 'border-slate-200', tag: 'bg-slate-100 text-slate-800' },
};

export function BoardContent() {
  const routeParams = useParams();
  const searchParams = useSearchParams();
  const pin = ((routeParams?.pin as string) || searchParams?.get('pin') || '').trim();

  const [room, setRoom] = useState<Room | null>(null);
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'columns' | 'grid'>('columns');
  const [isFullScreen, setIsFullScreen] = useState(false);

  // New Post Form State
  const [showModal, setShowModal] = useState(false);
  const [authorName, setAuthorName] = useState('');
  const [content, setContent] = useState('');
  const [selectedColumn, setSelectedColumn] = useState('칭찬합니다 👍');
  const [selectedColor, setSelectedColor] = useState<BoardPost['color']>('yellow');
  const [submitting, setSubmitting] = useState(false);

  // Load saved author name from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedName = localStorage.getItem('classhub_author_name') || '';
      setAuthorName(savedName);
    }
  }, []);

  // Fetch Room & Initial Posts
  useEffect(() => {
    if (!pin) {
      setLoading(false);
      return;
    }

    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function init() {
      setLoading(true);
      // Fetch room
      const { data: roomData, error: roomErr } = await supabase
        .from('rooms')
        .select('*')
        .eq('pin_code', pin)
        .single();

      if (roomErr || !roomData) {
        setLoading(false);
        return;
      }

      setRoom(roomData as Room);
      if (roomData.settings?.columns && roomData.settings.columns.length > 0) {
        setSelectedColumn(roomData.settings.columns[0]);
      }

      // Fetch posts
      const { data: postsData } = await supabase
        .from('board_posts')
        .select('*')
        .eq('room_id', roomData.id)
        .order('created_at', { ascending: false });

      setPosts((postsData || []) as BoardPost[]);
      setLoading(false);

      // Setup Realtime Subscription
      channel = supabase
        .channel(`board-realtime-${roomData.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'board_posts',
            filter: `room_id=eq.${roomData.id}`,
          },
          (payload) => {
            const newPost = payload.new as BoardPost;
            setPosts((prev) => [newPost, ...prev.filter((p) => p.id !== newPost.id)]);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'board_posts',
            filter: `room_id=eq.${roomData.id}`,
          },
          (payload) => {
            const updated = payload.new as BoardPost;
            setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'board_posts',
            filter: `room_id=eq.${roomData.id}`,
          },
          (payload) => {
            const deleted = payload.old as { id: string };
            setPosts((prev) => prev.filter((p) => p.id !== deleted.id));
          }
        )
        .subscribe();
    }

    init();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [pin]);

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullScreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullScreen(false);
      }
    }
  };

  const handleLike = async (post: BoardPost) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, likes_count: p.likes_count + 1 } : p))
    );

    await supabase
      .from('board_posts')
      .update({ likes_count: post.likes_count + 1 })
      .eq('id', post.id);
  };

  const handleDelete = async (postId: string) => {
    if (confirm('이 포스트잇을 삭제하시겠습니까?')) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      await supabase.from('board_posts').delete().eq('id', postId);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorName.trim() || !content.trim() || !room) return;

    setSubmitting(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('classhub_author_name', authorName.trim());
    }

    const { error } = await supabase.from('board_posts').insert({
      room_id: room.id,
      author_name: authorName.trim(),
      content: content.trim(),
      column_name: selectedColumn,
      color: selectedColor,
      likes_count: 0,
    });

    setSubmitting(false);
    if (!error) {
      setContent('');
      setShowModal(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-600">보드를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 text-center">
        <h2 className="text-2xl font-bold text-slate-800">보드를 찾을 수 없습니다</h2>
        <p className="text-sm text-slate-500 mt-2">PIN 번호가 올바르지 않거나 삭제된 보드입니다.</p>
        <Link
          href="/"
          className="mt-6 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition"
        >
          홈으로 돌아가기
        </Link>
      </div>
    );
  }

  const columns = room.settings?.columns && room.settings.columns.length > 0
    ? room.settings.columns
    : ['칭찬합니다 👍', '수업 소감 💡', '하고 싶은 말 💬'];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
              title="홈으로"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg text-slate-900">{room.title}</h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-mono text-xs font-bold">
                  PIN: {room.pin_code}
                </span>
              </div>
              {room.description && (
                <p className="text-xs text-slate-500 line-clamp-1">{room.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600">
              <button
                onClick={() => setViewMode('columns')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition ${
                  viewMode === 'columns' ? 'bg-white text-indigo-600 shadow-sm font-bold' : 'hover:text-slate-900'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
                <span>컬럼별</span>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition ${
                  viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm font-bold' : 'hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>전체 그리드</span>
              </button>
            </div>

            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
              title="초대 링크 복사"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? '복사완료' : '링크 복사'}</span>
            </button>

            <button
              onClick={handleToggleFullscreen}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
              title="전자칠판 전체화면"
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs sm:text-sm shadow-md shadow-amber-200 transition"
            >
              <Plus className="w-4 h-4" />
              <span>포스트잇 쓰기</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Board Canvas */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full overflow-x-auto">
        {posts.length === 0 ? (
          <div className="h-96 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-300 rounded-3xl bg-white/60">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">아직 작성된 포스트잇이 없습니다</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              첫 번째 포스트잇을 남겨보세요! 학생들이 스마트폰으로 PIN 코드를 입력하고 실시간으로 참여할 수 있습니다.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-5 px-5 py-2.5 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 shadow-md transition"
            >
              + 첫 번째 포스트잇 작성하기
            </button>
          </div>
        ) : viewMode === 'columns' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {columns.map((colName) => {
              const colPosts = posts.filter((p) => p.column_name === colName);
              return (
                <div key={colName} className="bg-slate-200/60 rounded-3xl p-4 flex flex-col gap-4">
                  <div className="flex items-center justify-between px-2 pt-1">
                    <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                      <span>{colName}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-300 text-slate-700 font-bold">
                        {colPosts.length}
                      </span>
                    </h3>
                    <button
                      onClick={() => {
                        setSelectedColumn(colName);
                        setShowModal(true);
                      }}
                      className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-300/60 transition"
                      title="이 컬럼에 작성"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-3 min-h-[150px]">
                    {colPosts.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-300 rounded-2xl">
                        포스트잇을 추가해보세요
                      </div>
                    ) : (
                      colPosts.map((post) => (
                        <PostCard
                          key={post.id}
                          post={post}
                          onLike={() => handleLike(post)}
                          onDelete={() => handleDelete(post.id)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onLike={() => handleLike(post)}
                onDelete={() => handleDelete(post.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Floating Action Button */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-6 right-6 sm:hidden w-14 h-14 rounded-full bg-amber-500 text-white shadow-xl shadow-amber-300 flex items-center justify-center text-xl z-40 active:scale-95 transition"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Write Post Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <span>📝 포스트잇 작성</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  작성자 이름 / 닉네임 *
                </label>
                <input
                  type="text"
                  required
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="예: 3반 김민우 or 1모둠"
                  className="w-full text-sm py-2.5 px-3 rounded-xl border border-slate-300 focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  모둠 / 주제 선택
                </label>
                <select
                  value={selectedColumn}
                  onChange={(e) => setSelectedColumn(e.target.value)}
                  className="w-full text-sm py-2.5 px-3 rounded-xl border border-slate-300 focus:border-indigo-600 focus:outline-none bg-white"
                >
                  {columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">포스트잇 색상</label>
                <div className="flex items-center gap-2">
                  {(['yellow', 'green', 'blue', 'pink', 'purple', 'white'] as BoardPost['color'][]).map(
                    (colorKey) => {
                      const colorInfo = COLOR_CLASSES[colorKey];
                      return (
                        <button
                          key={colorKey}
                          type="button"
                          onClick={() => setSelectedColor(colorKey)}
                          className={`w-8 h-8 rounded-full border-2 ${colorInfo.bg} ${
                            colorInfo.border
                          } transition flex items-center justify-center ${
                            selectedColor === colorKey ? 'ring-2 ring-indigo-600 ring-offset-2' : ''
                          }`}
                        >
                          {selectedColor === colorKey && (
                            <span className="w-2 h-2 rounded-full bg-slate-700" />
                          )}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">내용 *</label>
                <textarea
                  required
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="친구들과 나누고 싶은 생각, 의견, 칭찬을 적어주세요."
                  className="w-full text-sm p-3 rounded-xl border border-slate-300 focus:border-indigo-600 focus:outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
                >
                  {submitting ? '게시 중...' : '보드에 붙이기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function PostCard({
  post,
  onLike,
  onDelete,
}: {
  post: BoardPost;
  onLike: () => void;
  onDelete: () => void;
}) {
  const color = COLOR_CLASSES[post.color] || COLOR_CLASSES.yellow;

  return (
    <div
      className={`rounded-2xl p-4 border shadow-sm transition hover:shadow-md flex flex-col justify-between ${color.bg} ${color.border}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-6 rounded-full bg-black/10 flex items-center justify-center text-xs font-bold">
              {post.author_name.charAt(0)}
            </span>
            <span className="text-xs font-bold text-slate-800">{post.author_name}</span>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${color.tag}`}>
            {post.column_name}
          </span>
        </div>

        <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed break-words font-medium">
          {post.content}
        </p>
      </div>

      <div className="mt-4 pt-2 border-t border-black/5 flex items-center justify-between text-xs text-slate-500">
        <button
          onClick={onLike}
          className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-black/5 transition text-rose-600 font-semibold"
          title="좋아요"
        >
          <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
          <span>{post.likes_count}</span>
        </button>

        <button
          onClick={onDelete}
          className="p-1 rounded text-slate-400 hover:text-rose-600 transition"
          title="삭제"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function BoardView() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <BoardContent />
    </Suspense>
  );
}
