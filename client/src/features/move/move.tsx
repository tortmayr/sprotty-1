import { SChildElement } from '../../base';
import * as snabbdom from "snabbdom-jsx"
import { VNode } from "snabbdom/vnode"
import { Point } from "../../utils/geometry"
import { getParent, SModelElement, SModelIndex, SModelRoot } from "../../base/model/smodel"
import { Action } from "../../base/intent/actions"
import { ICommand, CommandExecutionContext, MergeableCommand } from "../../base/intent/commands"
import { Animation } from "../../base/animations/animation"
import { MouseListener } from "../../base/view/mouse-tool"
import { isViewport, Viewport } from "../viewport/model"
import { isSelectable } from "../select/model"
import { isMoveable, Locateable, isLocateable } from "./model"
import { setAttr } from "../../base/view/vnode-utils"

const JSX = {createElement: snabbdom.svg}

export class MoveAction implements Action {
    kind = MoveCommand.KIND

    constructor(public readonly moves: ElementMove[],
                public readonly animate: boolean = true) {
    }
}

export interface ElementMove {
    fromPosition?: Point
    elementId: string
    toPosition: Point
}

export interface ResolvedElementMove {
    fromPosition: Point
    elementId: string
    element: SModelElement & Locateable
    toPosition: Point
}

export class MoveCommand extends MergeableCommand {
    static readonly KIND = 'move'

    resolvedMoves: Map<string, ResolvedElementMove> = new Map

    constructor(protected action: MoveAction) {
        super()
    }

    execute(context: CommandExecutionContext) {
        const model = context.root
        this.action.moves.forEach(
            move => {
                const resolvedMove = this.resolve(move, model.index)
                if (resolvedMove) {
                    this.resolvedMoves.set(resolvedMove.elementId, resolvedMove)
                    if (!this.action.animate) {
                        resolvedMove.element.position = move.toPosition
                    }
                }
            }
        )
        if (this.action.animate)
            return new MoveAnimation(model, this.resolvedMoves, context, false).start()
        else
            return model
    }

    protected resolve(move: ElementMove, index: SModelIndex<SModelElement>): ResolvedElementMove | undefined {
        const element = index.getById(move.elementId) as (SModelElement & Locateable)
        if (element) {
            const fromPosition = move.fromPosition || { x: element.position.x, y: element.position.y }
            return {
                fromPosition: fromPosition,
                elementId: move.elementId,
                element: element,
                toPosition: move.toPosition
            }
        }
        return undefined
    }

    undo(context: CommandExecutionContext) {
        return new MoveAnimation(context.root, this.resolvedMoves, context, true).start()
    }

    redo(context: CommandExecutionContext) {
        return new MoveAnimation(context.root, this.resolvedMoves, context, false).start()
    }

    merge(command: ICommand, context: CommandExecutionContext) {
        if (!this.action.animate && command instanceof MoveCommand) {
            command.action.moves.forEach(
                otherMove => {
                    const existingMove = this.resolvedMoves.get(otherMove.elementId)
                    if (existingMove) {
                        existingMove.toPosition = otherMove.toPosition
                    } else {
                        const resolvedMove = this.resolve(otherMove, context.root.index)
                        if (resolvedMove)
                            this.resolvedMoves.set(resolvedMove.elementId, resolvedMove)
                    }
                }
            )
            return true
        }
        return false
    }
}

export class MoveAnimation extends Animation {

    constructor(protected model: SModelRoot,
                public elementMoves: Map<string, ResolvedElementMove>,
                context: CommandExecutionContext,
                protected reverse: boolean = false) {
        super(context)
    }

    tween(t: number) {
        this.elementMoves.forEach(
            (elementMove) => {
                if (this.reverse) {
                    elementMove.element.position = {
                        x: (1 - t) * elementMove.toPosition.x + t * elementMove.fromPosition.x,
                        y: (1 - t) * elementMove.toPosition.y + t * elementMove.fromPosition.y
                    }
                } else {
                    elementMove.element.position = {
                        x: (1 - t) * elementMove.fromPosition.x + t * elementMove.toPosition.x,
                        y: (1 - t) * elementMove.fromPosition.y + t * elementMove.toPosition.y
                    }
                }
            }
        )
        return this.model
    }
}

export class MoveMouseListener extends MouseListener {

    hasDragged = false
    lastDragPosition: Point | undefined

    mouseDown(target: SModelElement, event: MouseEvent): Action[] {
        if (event.button == 0) {
            if (isMoveable(target)) {
                this.lastDragPosition = {x: event.clientX, y: event.clientY}
            } else {
                this.lastDragPosition = undefined
            }
            this.hasDragged = false
        }
        return []
    }

    mouseMove(target: SModelElement, event: MouseEvent): Action[] {
        if(event.buttons == 0) 
            this.mouseUp(target, event)
        else if (this.lastDragPosition) {
            const viewport = getParent<Viewport>(target, isViewport)
            this.hasDragged = true
            const zoom = viewport ? viewport.zoom : 1
            const dx = (event.clientX - this.lastDragPosition.x) / zoom
            const dy = (event.clientY - this.lastDragPosition.y) / zoom
            const root = target.root
            const nodeMoves: ElementMove[] = []
            root
                .index
                .all()
                .filter(
                    element => isSelectable(element) && element.selected
                )
                .forEach(
                    element => {
                        if (isMoveable(element)) {
                            nodeMoves.push({
                                elementId: element.id,
                                toPosition: {
                                    x: element.position.x + dx,
                                    y: element.position.y + dy
                                }
                            })
                        }
                    })
            this.lastDragPosition = {x: event.clientX, y: event.clientY}
            if (nodeMoves.length > 0)
                return [new MoveAction(nodeMoves, false)]
        }
        return []
    }

    mouseUp(target: SModelElement, event: MouseEvent): Action[] {
        this.hasDragged = false
        this.lastDragPosition = undefined
        return []
    }

    decorate(vnode: VNode, element: SModelElement): VNode {
        if (isLocateable(element) && element instanceof SChildElement && element.parent !== undefined) {
            const translate = 'translate(' + element.position.x + ', ' + element.position.y + ')'
            setAttr(vnode, 'transform', translate)
        }
        return vnode
    }
}