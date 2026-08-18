'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { isUnauthenticated, requireUser, SIGNED_OUT_MESSAGE } from '@/lib/session'
import { createOrder, isConfigured, publicKeyId } from '@/lib/razorpay'
import { grantForPayment } from '@/lib/entitle'
import { reportError } from '@/lib/observability'

export type CheckoutState = {
  error?: string
  /** Present when a real Razorpay order is ready for the browser to open. */
  order?: { keyId: string; orderId: string; amountPaise: number; name: string; email: string }
}

/**
 * Development-only escape hatch so the paywall stays exercisable without live
 * payment keys. Double-gated: never in a production build, and off unless the
 * operator explicitly opts in.
 */
function mockAllowed() {
  return process.env.NODE_ENV !== 'production' && process.env.ALLOW_MOCK_CHECKOUT === '1'
}

/**
 * Prices are read from the database, never from the form — a client that posts
 * its own amount must not be able to buy a bundle for one rupee.
 */
async function resolvePlan(scope: 'COURSE' | 'CLASS', id: string) {
  if (scope === 'CLASS') {
    const classLevel = await prisma.classLevel.findUnique({ where: { id } })
    if (!classLevel?.bundlePricePaise) return null
    return {
      amountPaise: classLevel.bundlePricePaise,
      label: `Complete ${classLevel.label}`,
      courseId: null as string | null,
      classLevelId: classLevel.id as string | null,
      coveredByClassLevelId: classLevel.id,
    }
  }

  const course = await prisma.course.findUnique({
    where: { id },
    include: { subject: true, classLevel: true },
  })
  if (!course) return null
  return {
    amountPaise: course.pricePaise,
    label: `${course.subject.name} — ${course.classLevel.label}`,
    courseId: course.id as string | null,
    classLevelId: null as string | null,
    /** The class this sits in — a bundle for that class already includes it. */
    coveredByClassLevelId: course.classLevelId,
  }
}

export async function startCheckout(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  let user
  try {
    user = await requireUser()
  } catch (err) {
    if (isUnauthenticated(err)) return { error: SIGNED_OUT_MESSAGE }
    throw err
  }

  const scope = formData.get('scope') === 'CLASS' ? 'CLASS' : 'COURSE'
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Choose a plan first' }

  const plan = await resolvePlan(scope, id)
  if (!plan) return { error: 'That plan is no longer available' }
  if (plan.amountPaise <= 0) return { error: 'This plan has no price set' }

  // Don't sell what the student already has. Matching only the same scope let a
  // bundle holder buy a single subject inside the class they had already paid
  // for in full — a second charge for access they were already getting, and one
  // getEntitlements would never even consult.
  const existing = await prisma.subscription.findFirst({
    where: {
      userId: user.id,
      status: 'ACTIVE',
      endsAt: { gt: new Date() },
      OR: [
        scope === 'CLASS' ? { classLevelId: plan.classLevelId } : { courseId: plan.courseId },
        { scope: 'CLASS' as const, classLevelId: plan.coveredByClassLevelId },
      ],
    },
  })
  if (existing) {
    return {
      error:
        existing.scope === 'CLASS' && scope === 'COURSE'
          ? 'Your class bundle already includes this subject.'
          : 'You already have access to this plan.',
    }
  }

  if (!isConfigured()) {
    if (!mockAllowed()) {
      return {
        error:
          'Payments are not configured on this server. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.',
      }
    }

    // Mock path: record the payment and grant immediately, exactly as the
    // webhook would, so the rest of the flow is identical.
    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        scope,
        courseId: plan.courseId,
        classLevelId: plan.classLevelId,
        amountPaise: plan.amountPaise,
        provider: 'mock',
        providerOrderId: `mock_${randomUUID()}`,
      },
    })
    await grantForPayment(payment.id)
    revalidatePath('/academic', 'layout')
    // Navigate from the server. Returning a flag and pushing from a client
    // effect doesn't survive the revalidation above — it remounts the form and
    // resets useActionState before the effect ever sees the flag.
    redirect('/academic?purchased=1')
  }

  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      scope,
      courseId: plan.courseId,
      classLevelId: plan.classLevelId,
      amountPaise: plan.amountPaise,
      // Filled in below; unique, so a placeholder keeps the row valid until then.
      providerOrderId: `pending_${randomUUID()}`,
    },
  })

  try {
    const order = await createOrder({
      amountPaise: plan.amountPaise,
      receipt: payment.id,
      notes: { paymentId: payment.id, userId: user.id, plan: plan.label },
    })

    await prisma.payment.update({
      where: { id: payment.id },
      data: { providerOrderId: order.id },
    })

    return {
      order: {
        keyId: publicKeyId()!,
        orderId: order.id,
        amountPaise: plan.amountPaise,
        name: user.name,
        email: user.email,
      },
    }
  } catch (err) {
    // A payment provider that has started refusing orders is invisible from
    // outside — the page just says "try again" — so this is one to be told about.
    reportError('checkout/order', err, { userId: user.id, scope, planId: id })
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED', failureReason: 'Order creation failed' },
    })
    return { error: 'We could not reach the payment provider. Please try again.' }
  }
}
