import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class ExampleData {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    symbol!: string;

    @Column('float')
    price!: number;

    @Column('bigint')
    timestamp!: number;

    @Column('float')
    volume!: number;
}