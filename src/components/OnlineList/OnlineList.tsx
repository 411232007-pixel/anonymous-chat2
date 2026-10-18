import type { User } from '../../chat/types'
import { Avatar } from '../Avatar'

/** 線上名單。自己排第一,用粗體並標示「(你)」 */
export function OnlineList({ users, selfId }: { users: User[]; selfId: string }) {
  return (
    <ul className="online-list">
      {users.map((user) => {
        const isSelf = user.clientId === selfId
        return (
          <li key={user.clientId} className="online-list__item">
            <Avatar nickname={user.nickname} size="sm" />
            <span className={isSelf ? 'online-list__name online-list__name--self' : 'online-list__name'}>
              {user.nickname}
            </span>
            {isSelf && <span className="online-list__you">(你)</span>}
          </li>
        )
      })}
    </ul>
  )
}
