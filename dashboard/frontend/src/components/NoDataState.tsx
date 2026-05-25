interface NoDataStateProps {
  message: string
}

export function NoDataState({ message }: NoDataStateProps) {
  return (
    <div className="no-data">
      <h3>Sem dados para os filtros atuais</h3>
      <p>{message || 'Limpe um ou mais filtros para ampliar o resultado.'}</p>
    </div>
  )
}

