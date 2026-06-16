import ExpenseDetail from './ExpenseDetail'  
  
export function generateStaticParams() {  
  return [{ id: 'index' }]  
}  
  
export default function ExpenseDetailPage() {  
  return <ExpenseDetail />  
} 
