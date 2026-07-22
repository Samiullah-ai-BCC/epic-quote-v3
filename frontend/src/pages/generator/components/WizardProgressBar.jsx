// One filled segment per completed wizard step.
export default function WizardProgressBar({ flow, currentIndex }) {
  return (
    <div className="prog">
      {flow.map((s, index) => <div key={s} className={'prog-seg' + (index <= currentIndex ? ' done' : '')} />)}
    </div>
  )
}
