import {VNode} from "snabbdom/vnode"
import {SModelElement} from "../model"
import {VNodeUtils} from "./vnode-utils"

/**
 * Manipulates a created VNode after it has been created.
 * Used to register listeners and add animations.
 */
export interface VNodeDecorator {
    decorate(vnode: VNode, element: SModelElement): VNode

    postUpdate(): void
}

export class AddRemoveAnimationDecorator implements VNodeDecorator {

    readonly appearFadeStyle = {
        opacity: '0',
        transition: 'opacity 0.5s',
        delayed: {opacity: '1'},
        remove: {opacity: '0'}
    }

    decorate(vnode: VNode, element: SModelElement) {
        VNodeUtils.mergeStyle(vnode, this.appearFadeStyle)
        return vnode
    }

    postUpdate() {
    }
}