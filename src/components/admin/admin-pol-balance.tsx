'use client'

import { useCallback, useEffect, useState } from 'react'
import { Coins, RefreshCw, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const POLL_MS = 120_000
/** Umbral ámbar: conviene recargar pronto */
const WARN_POLY = 1
/** Umbral crítico: muy pocas transacciones de margen */
const CRITICAL_POLY = 0.15

const POLYGON_EXPLORER = 'https://polygonscan.com'

function parseBalancePoly(balanceStr: string): number | null {
  const trimmed = balanceStr.trim()
  const m = trimmed.match(/^([\d.]+)\s*POL$/i)
  if (!m) return null
  const n = parseFloat(m[1])
  return Number.isFinite(n) ? n : null
}

function formatPolyDisplay(n: number): string {
  return `${n.toLocaleString('es-AR', { maximumFractionDigits: 6 })} POL`
}

type Snapshot =
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      balanceRaw: string
      numeric: number | null
      walletAddress: string | null
      variant: 'ok' | 'warn' | 'critical' | 'unconfigured'
    }

export function AdminPolBalance() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [isFetching, setIsFetching] = useState(true)

  const load = useCallback(async () => {
    setIsFetching(true)
    try {
      const res = await fetch('/api/polygon/network')
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'No se pudo leer el saldo POL')
      }
      const balanceRaw: string = json.data?.balance ?? ''
      const walletAddress: string | null = json.data?.walletAddress ?? null

      if (
        balanceRaw.includes('Wallet no configurada') ||
        balanceRaw === 'N/A'
      ) {
        setSnapshot({
          status: 'ready',
          balanceRaw,
          numeric: null,
          walletAddress,
          variant: 'unconfigured',
        })
        return
      }

      const numeric = parseBalancePoly(balanceRaw)
      let variant: 'ok' | 'warn' | 'critical' | 'unconfigured' = 'ok'
      if (numeric == null) {
        variant = 'unconfigured'
      } else if (numeric <= CRITICAL_POLY) {
        variant = 'critical'
      } else if (numeric < WARN_POLY) {
        variant = 'warn'
      }

      setSnapshot({
        status: 'ready',
        balanceRaw,
        numeric,
        walletAddress,
        variant,
      })
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : 'Error al obtener saldo POL'
      setSnapshot({ status: 'error', message })
    } finally {
      setIsFetching(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load(), POLL_MS)
    return () => window.clearInterval(id)
  }, [load])

  const badgeClass =
    snapshot?.status === 'ready'
      ? {
          ok: 'border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
          warn: 'border-amber-600/40 bg-amber-500/15 text-amber-900 dark:text-amber-200',
          critical:
            'border-destructive/50 bg-destructive/15 text-destructive dark:text-red-300',
          unconfigured:
            'border-muted-foreground/40 bg-muted text-muted-foreground',
        }[snapshot.variant]
      : ''

  const labelShort =
    snapshot === null && isFetching
      ? 'POL…'
      : snapshot?.status === 'error'
        ? 'POL — error'
        : snapshot?.status === 'ready' && snapshot.numeric != null
          ? formatPolyDisplay(snapshot.numeric)
          : snapshot?.status === 'ready'
            ? snapshot.balanceRaw
            : 'POL…'

  const tooltipLines =
    snapshot?.status === 'ready'
      ? [
          snapshot.numeric != null
            ? `Saldo firma (gas): ${formatPolyDisplay(snapshot.numeric)}`
            : snapshot.balanceRaw,
          snapshot.walletAddress
            ? `Wallet: ${snapshot.walletAddress}`
            : 'Wallet no disponible',
          snapshot.variant === 'critical'
            ? 'Crítico: recargá POL cuanto antes para no cortar certificaciones.'
            : snapshot.variant === 'warn'
              ? 'Saldo bajo: planificá recarga de POL.'
              : snapshot.variant === 'unconfigured'
                ? 'Revisá POLYGON_PRIVATE_KEY y variables en el servidor.'
                : null,
        ].filter(Boolean) as string[]
      : snapshot?.status === 'error'
        ? [snapshot.message]
        : ['Consultando saldo de la wallet de certificación…']

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'flex max-w-[min(100vw-12rem,14rem)] cursor-default items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium sm:max-w-none',
                snapshot?.status === 'ready'
                  ? badgeClass
                  : snapshot?.status === 'error'
                    ? 'border-destructive/40 bg-destructive/10 text-destructive'
                    : 'border-border bg-muted/50 text-muted-foreground'
              )}
            >
              <Coins className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              <span className="truncate" title={labelShort}>
                {labelShort}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="end" className="max-w-xs">
            <div className="space-y-1 text-left">
              <p className="font-semibold">POL para gas (Polygon)</p>
              {tooltipLines.map((line, i) => (
                <p key={i} className="text-xs opacity-90">
                  {line}
                </p>
              ))}
              <p className="text-[11px] text-muted-foreground">
                Actualización automática cada {POLL_MS / 60_000} min.
              </p>
              {snapshot?.status === 'ready' && snapshot.walletAddress && (
                <a
                  href={`${POLYGON_EXPLORER}/address/${snapshot.walletAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
                >
                  Ver en Polygonscan
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => void load()}
          aria-label="Actualizar saldo POL"
          disabled={isFetching}
        >
          <RefreshCw
            className={cn('h-4 w-4', isFetching && 'animate-spin')}
          />
        </Button>
      </div>
    </TooltipProvider>
  )
}
