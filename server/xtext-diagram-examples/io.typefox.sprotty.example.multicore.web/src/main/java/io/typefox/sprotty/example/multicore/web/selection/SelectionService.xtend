package io.typefox.sprotty.example.multicore.web.selection

import com.google.inject.Inject
import io.typefox.sprotty.example.multicore.multicoreAllocation.Program
import io.typefox.sprotty.example.multicore.multicoreAllocation.Step
import org.eclipse.emf.ecore.EObject
import org.eclipse.xtext.resource.EObjectAtOffsetHelper
import org.eclipse.xtext.web.server.model.IXtextWebDocument
import org.eclipse.xtext.web.server.model.XtextWebDocumentAccess

import static extension org.eclipse.xtext.EcoreUtil2.*
import static extension org.eclipse.xtext.nodemodel.util.NodeModelUtils.*

class SelectionService {
	
	@Inject extension EObjectAtOffsetHelper
	
	def getOffsetById(XtextWebDocumentAccess access, String modelType, String elementId, int caretOffset) {
		access.readOnly[ doc, cancelIndicator |
			val program = doc.resource.contents.head as Program
			val currentSelection = doc.getCurrentSelection(caretOffset)
			val element = getObjectById(program, currentSelection, modelType, elementId)
			val node = element.node
			return new SelectionResult(if (node !== null) node.offset else -1)
		]
	}
	
	def getNextStepOffset(XtextWebDocumentAccess access, int caretOffset) {
		access.readOnly[ doc, cancelIndicator |
			val program = doc.resource.contents.head as Program
			val currentSelection = doc.getCurrentSelection(caretOffset)
			val currentStep = currentSelection.getContainerOfType(Step)
			val allSteps = program.declarations.filter(Step)
			val nextStep = if (currentStep === null)
				allSteps.minBy[index]
			else if (allSteps.exists[index > currentStep.index])
				allSteps.filter[index > currentStep.index].minBy[index]
			else
				currentStep
			val node = nextStep.node
			return new SelectionResult(if (node !== null) node.offset else -1)
		]
	}
	
	def getPreviousStepOffset(XtextWebDocumentAccess access, int caretOffset) {
		access.readOnly[ doc, cancelIndicator |
			val program = doc.resource.contents.head as Program
			val currentSelection = doc.getCurrentSelection(caretOffset)
			val currentStep = currentSelection.getContainerOfType(Step)
			val allSteps = program.declarations.filter(Step)
			val previousStep = if (currentStep === null)
				allSteps.maxBy[index]
			else if (allSteps.exists[index < currentStep.index])
				allSteps.filter[index < currentStep.index].maxBy[index]
			else
				currentStep
			val node = previousStep.node
			return new SelectionResult(if (node !== null) node.offset else -1)
		]
	}
	
	protected def EObject getCurrentSelection(IXtextWebDocument doc, int caretOffset) {
		var element = doc.resource.resolveContainedElementAt(caretOffset)
		var node = element.node
		while (node !== null && !node.textRegion.contains(caretOffset)) {
			element = element.eContainer
			node = element.node
		}
		return element
	}
	
	protected def EObject getObjectById(Program program, EObject currentSelection, String modelType, String elementId) {
		switch modelType {
			case 'processor': {
				if (elementId == 'processor') {
					return currentSelection.getContainerOfType(Step)
				} else if (elementId.startsWith('core_')) {
					val coreIndex = Integer.parseInt(elementId.substring('core_'.length))
					val currentStep = currentSelection.getContainerOfType(Step)
					if (currentStep !== null) {
						for (allocation : currentStep.allocations) {
							if (allocation.core == coreIndex)
								return allocation
						}
					}
				}
			}
			case 'flow': {
				if (elementId == 'flow') {
					return currentSelection.getContainerOfType(Step)
				} else if (elementId.startsWith('task_')) {
					val taskName = elementId.substring('task_'.length)
					val currentStep = currentSelection.getContainerOfType(Step)
					if (currentStep !== null) {
						for (allocation : currentStep.allocations) {
							if (allocation.task?.name == taskName)
								return allocation
						}
					}
					for (step : program.declarations.filter(Step)) {
						for (allocation : step.allocations) {
							if (allocation.task?.name == taskName)
								return allocation
						}
					}
				}
			}
		}
	}
	
}
