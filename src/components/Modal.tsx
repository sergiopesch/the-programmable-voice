import { useEffect, useId, useRef, type ReactNode } from 'react'
import { CloseIcon } from './Icons'

interface ModalProps {
  open: boolean
  id?: string
  title: string
  onClose: () => void
  children: ReactNode
  className?: string
}

export function Modal({ open, id, title, onClose, children, className = '' }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  const close = () => {
    onClose()
    requestAnimationFrame(() => returnFocusRef.current?.focus())
  }

  return (
    <dialog
      ref={dialogRef}
      id={id}
      className={`modal ${className}`}
      aria-labelledby={titleId}
      onKeyDownCapture={(event) => {
        if (event.key !== 'Escape') return
        event.preventDefault()
        close()
      }}
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
      onClose={() => {
        if (open) onClose()
      }}
    >
      <header className="modal__header">
        <h2 id={titleId}>{title}</h2>
        <button className="icon-button" type="button" onClick={close} aria-label={`Close ${title}`}>
          <CloseIcon />
        </button>
      </header>
      <div className="modal__body">{children}</div>
    </dialog>
  )
}
