'use client'
import { useFormStatus } from 'react-dom'

export default function SubmitButton({ label, loadingLabel }: { label: string; loadingLabel: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-3.5 bg-white text-gray-900 font-bold rounded-xl text-sm hover:bg-gray-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-0.5 hover:shadow-lg hover:shadow-white/10"
    >
      {pending ? loadingLabel : label}
    </button>
  )
}
