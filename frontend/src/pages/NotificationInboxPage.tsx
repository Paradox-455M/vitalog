import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { useNotifications } from '../hooks/useNotifications'
import { api } from '../lib/api'
import type { NotificationListItem } from '../lib/api'
import { formatRelativeTime } from '../lib/formatRelativeTime'

export function NotificationInboxPage() {
  const navigate = useNavigate()
  const { items, unreadCount, nextCursor, loading, markRead, markAllRead } =
    useNotifications({ limit: 50, loadOnMount: true })

  const [extraItems, setExtraItems] = useState<NotificationListItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  // On first render, use nextCursor from hook; after first "load more", use local cursor
  const activeCursor = cursor !== null ? cursor : nextCursor

  const allItems = [...items, ...extraItems]

  const handleLoadMore = useCallback(async () => {
    if (!activeCursor) return
    setLoadingMore(true)
    try {
      const res = await api.notifications.list({ limit: 50, before: activeCursor })
      setExtraItems((prev) => [...prev, ...res.items])
      setCursor(res.next_cursor)
    } finally {
      setLoadingMore(false)
    }
  }, [activeCursor])

  const handleClick = useCallback(
    async (notif: NotificationListItem) => {
      if (!notif.read) {
        await markRead(notif.id)
      }
      if (notif.document_id) {
        navigate(`/reports/${notif.document_id}`)
      }
    },
    [markRead, navigate],
  )

  return (
    <div className="flex-1 h-screen overflow-y-auto scroll-smooth">
      <TopBar title="Notifications" showCta={false} />

      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto space-y-6">
        {/* Header with mark all read */}
        {unreadCount > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-on-surface-variant">
              {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </p>
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="text-sm font-semibold text-primary hover:underline"
            >
              Mark all as read
            </button>
          </div>
        )}

        {/* Loading state */}
        {loading && allItems.length === 0 && (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-20 rounded-xl bg-surface-container animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && allItems.length === 0 && (
          <div className="text-center py-20 space-y-4">
            <span className="material-symbols-outlined text-5xl text-outline/30">
              notifications_none
            </span>
            <p className="font-serif text-lg font-bold text-on-surface">No notifications yet</p>
            <p className="text-sm text-on-surface-variant">
              You'll see notifications here when your reports are processed or health trends are detected.
            </p>
          </div>
        )}

        {/* Notification list */}
        {allItems.length > 0 && (
          <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl overflow-hidden divide-y divide-outline-variant/10">
            {allItems.map((notif) => (
              <button
                key={notif.id}
                type="button"
                className={`w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-surface-container transition-colors ${
                  !notif.read ? 'bg-primary-fixed/10' : ''
                }`}
                onClick={() => void handleClick(notif)}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    !notif.read ? 'bg-primary-fixed' : 'bg-surface-container'
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-lg ${
                      !notif.read ? 'text-primary' : 'text-on-surface-variant'
                    }`}
                  >
                    {notif.icon}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm ${
                      !notif.read ? 'font-bold text-on-surface' : 'text-on-surface-variant'
                    }`}
                  >
                    {notif.title}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2">{notif.body}</p>
                  <p className="text-[10px] text-on-surface-variant/60 mt-1">
                    {formatRelativeTime(notif.created_at)}
                  </p>
                </div>
                {!notif.read && (
                  <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 mt-2" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Load more */}
        {activeCursor && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void handleLoadMore()}
              className="px-6 py-2.5 bg-surface-container text-on-surface-variant rounded-full text-sm font-semibold hover:bg-surface-container-high transition-colors disabled:opacity-50"
            >
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
