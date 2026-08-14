'use client'

import { useActionState, useState } from 'react'
import { updateClass, type ProfileState } from './actions'
import type { BoardOption } from '@/app/login/AuthForm'

const initial: ProfileState = {}

export function ClassSettings({
  boards,
  currentBoardId,
  currentClassId,
}: {
  boards: BoardOption[]
  currentBoardId?: string
  currentClassId?: string
}) {
  const [state, formAction, pending] = useActionState(updateClass, initial)
  const [boardId, setBoardId] = useState(currentBoardId ?? boards[0]?.id ?? '')

  const classes = boards.find((b) => b.id === boardId)?.classes ?? []
  const boardChanged = boardId !== currentBoardId

  return (
    <form action={formAction} className="rounded-3xl card-surface px-6 py-5">
      <p className="text-sm font-extrabold tracking-wider text-navy/45">BOARD &amp; CLASS</p>
      <p className="mt-1 text-sm font-semibold text-navy/50">
        Changing this changes which catalog you see. Anything you have already paid for stays tied to
        the class you bought it for.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-navy-deep">Board</span>
          <select
            name="boardId"
            value={boardId}
            onChange={(e) => setBoardId(e.target.value)}
            className="w-full rounded-xl border border-navy/15 bg-white px-3 py-2.5 font-semibold text-navy-deep outline-none transition focus:border-amber"
          >
            {boards.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} — {b.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-bold text-navy-deep">Class</span>
          <select
            name="classLevelId"
            key={boardId}
            defaultValue={boardChanged ? undefined : currentClassId}
            className="w-full rounded-xl border border-navy/15 bg-white px-3 py-2.5 font-semibold text-navy-deep outline-none transition focus:border-amber"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          disabled={pending}
          className="h-11 rounded-2xl flame-gradient px-5 font-extrabold text-white shadow-lg shadow-ember/25 transition hover:brightness-105 disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>

      {state.error && (
        <p role="alert" className="mt-3 rounded-xl bg-ember/10 px-3 py-2 text-sm font-semibold text-ember">
          {state.error}
        </p>
      )}
      {state.saved && (
        <p className="mt-3 rounded-xl bg-moss/10 px-3 py-2 text-sm font-semibold text-moss">
          Saved. Your catalog now shows this class.
        </p>
      )}
    </form>
  )
}
