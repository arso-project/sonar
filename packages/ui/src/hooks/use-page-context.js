import makeGlobalStateHook from './make-global-state-hook'

const useContextState = makeGlobalStateHook('context')

export function usePageContext () {
  const [context, setContext] = useContextState('context')
  return [context, setContext]
}
